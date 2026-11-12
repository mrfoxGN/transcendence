require('reflect-metadata');

const assert = require('node:assert/strict');
const { NestFactory } = require('@nestjs/core');
const { DataSource } = require('typeorm');

const { AppModule } = require('../../../app.module.ts');
const {
  TaskStatus,
} = require('../../../database/enums/database.enums.ts');
const { TasksService } = require('./tasks.service.ts');
const { Task } = require('../entities/task.entity.ts');
const {
  TaskStatusHistory,
} = require('../entities/task-status-history.entity.ts');
const {
  Workspace,
} = require('../../workspaces/entities/workspace.entity.ts');

const token = process.env.TEST_TOKEN;
const baseUrl = 'http://127.0.0.1:3000';

let context;
let database;
let testWorkspaceId;

async function http(method, path, body) {
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });

  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : undefined,
  };
}

async function expectHttp(method, path, body, status = 200) {
  const response = await http(method, path, body);

  assert.equal(
    response.status,
    status,
    `${method} ${path}: ${JSON.stringify(response.body?.message)}`,
  );

  return response.body;
}

async function checkDatabase() {
  assert.ok(token, 'AUTH is empty. Log in and save a current token first.');

  const actor = await expectHttp('GET', '/auth/profile');
  assert.equal(typeof actor.id, 'string');

  // Get the real service and database connection.
  context = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
    abortOnError: false,
  });

  database = context.get(DataSource);
  const tasksService = context.get(TasksService);

  const [session] = await database.query(
    'SELECT @@SESSION.sql_mode AS sqlMode',
  );

  assert.match(
    session.sqlMode,
    /STRICT_TRANS_TABLES|STRICT_ALL_TABLES/,
    'This check requires MySQL strict mode.',
  );

  const name = `Tasks database check ${Date.now()}`;

  const workspace = await expectHttp(
    'POST',
    '/workspaces',
    {
      name,
      description: 'Temporary Tasks integration checks',
    },
    201,
  );

  assert.equal(workspace.name, name);
  assert.equal(typeof workspace.id, 'string');

  testWorkspaceId = workspace.id;

  await expectHttp(
    'PATCH',
    `/workspaces/${testWorkspaceId}/kanban-settings`,
    { activeWipLimit: 1 },
  );

  const firstTask = await expectHttp(
    'POST',
    `/workspaces/${testWorkspaceId}/tasks`,
    { title: 'Integration task A' },
    201,
  );

  const secondTask = await expectHttp(
    'POST',
    `/workspaces/${testWorkspaceId}/tasks`,
    { title: 'Integration task B' },
    201,
  );

  const tasksRepository = database.getRepository(Task);
  const historyRepository = database.getRepository(TaskStatusHistory);

  // Call the service directly to bypass HTTP DTO validation.
  // The history note column only accepts 500 characters.
  let historyError;

  try {
    await tasksService.transition(firstTask.id, actor.id, {
      toStatus: TaskStatus.READY,
      note: 'x'.repeat(501),
    });
  } catch (error) {
    historyError = error;
  }

  assert.ok(
    historyError,
    'The oversized history note unexpectedly succeeded.',
  );

  const driver = historyError.driverError ?? historyError;

  assert.ok(
    driver.code === 'ER_DATA_TOO_LONG' || driver.errno === 1406,
    `Expected a database length error, received ${driver.code}.`,
  );

  const afterFailure = await tasksRepository.findOneByOrFail({
    id: firstTask.id,
  });

  assert.equal(
    afterFailure.status,
    TaskStatus.BACKLOG,
    'The failed history insert must roll back the task status.',
  );

  assert.equal(
    await historyRepository.count({
      where: { taskId: firstTask.id },
    }),
    0,
  );

  console.log('PASS: history failure rolled back the task status');

  // Prepare two tasks competing for one active WIP slot.
  for (const taskId of [firstTask.id, secondTask.id]) {
    await expectHttp(
      'POST',
      `/tasks/${taskId}/transition`,
      { toStatus: TaskStatus.READY },
      201,
    );
  }

  const attempts = await Promise.allSettled([
    http('POST', `/tasks/${firstTask.id}/transition`, {
      toStatus: TaskStatus.IN_PROGRESS,
    }),
    http('POST', `/tasks/${secondTask.id}/transition`, {
      toStatus: TaskStatus.IN_PROGRESS,
    }),
  ]);

  const results = attempts.map((attempt) => {
    if (attempt.status === 'rejected') {
      throw attempt.reason;
    }

    return attempt.value;
  });

  const statuses = results
    .map((result) => result.status)
    .sort((a, b) => a - b);

  assert.deepEqual(
    statuses,
    [201, 409],
    'Expected one successful transition and one WIP conflict.',
  );

  const conflict = results.find((result) => result.status === 409);

  assert.equal(
    conflict.body.message,
    'Active WIP limit reached',
  );

  const board = await expectHttp(
    'GET',
    `/workspaces/${testWorkspaceId}/board`,
  );

  assert.equal(board.activeWipLimit, 1);
  assert.equal(board.activeCount, 1);

  console.log('PASS: concurrent requests respected the WIP limit');

  const finalTasks = await tasksRepository.find({
    where: { workspaceId: testWorkspaceId },
  });

  assert.equal(finalTasks.length, 2);

  assert.equal(
    finalTasks.filter(
      (task) => task.status === TaskStatus.IN_PROGRESS,
    ).length,
    1,
  );

  assert.equal(
    finalTasks.filter(
      (task) => task.status === TaskStatus.READY,
    ).length,
    1,
  );

  const historyCount = await historyRepository.count({
    where: [
      { taskId: firstTask.id },
      { taskId: secondTask.id },
    ],
  });

  // Two READY transitions and one successful IN_PROGRESS transition.
  assert.equal(historyCount, 3);

  console.log('PASS: task statuses and history persisted correctly');
}

async function run() {
  try {
    await checkDatabase();
  } catch (error) {
    console.error('FAIL:', error.message);
    process.exitCode = 1;
  } finally {
    try {
      if (database?.isInitialized && testWorkspaceId) {
        // Delete only the workspace created by this script.
        // Foreign keys cascade to its tasks and related records.
        await database.getRepository(Workspace).delete({
          id: testWorkspaceId,
        });

        assert.equal(
          await database.getRepository(Task).count({
            where: { workspaceId: testWorkspaceId },
          }),
          0,
        );

        console.log('Cleanup: temporary workspace and tasks removed');
      }
    } catch (error) {
      console.error(
        `Cleanup failed for ${testWorkspaceId}: ${error.message}`,
      );
      process.exitCode = 1;
    } finally {
      if (context) {
        await context.close();
      }
    }
  }
}

run().catch((error) => {
  console.error('FAIL:', error.message);
  process.exitCode = 1;
});
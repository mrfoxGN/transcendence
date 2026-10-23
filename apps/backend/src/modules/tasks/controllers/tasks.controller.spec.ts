import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

// Test real HTTP routing, validation, and JwtAuthGuard without accessing MySQL.
jest.mock('../services/tasks.service', () => ({
  TasksService: class TasksService {},
}));
jest.mock('../../users/services/users.service', () => ({
  UsersService: class UsersService {},
}));

import {
  AppRole,
  TaskPriority,
  TaskStatus,
  UserStatus,
} from '../../../database/enums/database.enums';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UsersService } from '../../users/services/users.service';
import { TasksService } from '../services/tasks.service';
import { TasksController } from './tasks.controller';

const workspaceId = '44444444-4444-4444-8444-444444444444';
const userId = '55555555-5555-4555-8555-555555555555';
const otherUserId = '66666666-6666-4666-8666-666666666666';
const taskId = '11111111-1111-4111-8111-111111111111';
const otherTaskId = '22222222-2222-4222-8222-222222222222';
const dependencyId = '77777777-7777-4777-8777-777777777777';
const commentId = '88888888-8888-4888-8888-888888888888';
const timestamp = '2026-10-23T12:00:00.000Z';
const testSecret = 'tasks-controller-tests-only-secret';

const user = {
  id: userId,
  username: 'task_tester',
  email: 'task_tester@example.com',
  avatarUrl: null,
  appRole: AppRole.USER,
  status: UserStatus.ACTIVE,
  createdAt: new Date(timestamp),
  updatedAt: new Date(timestamp),
};

const task = {
  id: taskId,
  workspaceId,
  creatorId: userId,
  title: 'Build profile',
  description: null,
  acceptanceCriteria: null,
  status: TaskStatus.BACKLOG,
  priority: null,
  position: 0,
  isBlocked: false,
  blockedReason: null,
  blockedAt: null,
  dueAt: null,
  createdAt: timestamp,
  updatedAt: timestamp,
  completedAt: null,
  cancelledAt: null,
};

const comment = {
  id: commentId,
  taskId,
  authorId: userId,
  content: 'Please review',
  createdAt: timestamp,
  updatedAt: timestamp,
  editedAt: null,
};

const dependency = {
  id: dependencyId,
  taskId,
  dependsOnTaskId: otherTaskId,
  createdById: userId,
  createdAt: timestamp,
};

const assignment = {
  id: '99999999-9999-4999-8999-999999999999',
  taskId,
  userId: otherUserId,
  assignedById: userId,
  assignedAt: timestamp,
};

const methods = [
  'create',
  'getBoard',
  'findById',
  'update',
  'transition',
  'remove',
  'getAssignment',
  'assign',
  'unassign',
  'addComment',
  'listComments',
  'updateComment',
  'removeComment',
  'addDependency',
  'listDependencies',
  'removeDependency',
  'block',
  'unblock',
] as const;

type Method = (typeof methods)[number];
type Verb = 'get' | 'post' | 'patch' | 'delete';

type Route = {
  name: string;
  verb: Verb;
  path: string;
  method: Method;
  status: number;
  body?: Record<string, unknown>;
  args: unknown[];
  response: unknown;
};

const routes: Route[] = [
  {
    name: 'create task',
    verb: 'post',
    path: `/workspaces/${workspaceId}/tasks`,
    method: 'create',
    status: 201,
    body: { title: 'Build profile' },
    args: [workspaceId, userId, { title: 'Build profile' }],
    response: task,
  },
  {
    name: 'get board',
    verb: 'get',
    path: `/workspaces/${workspaceId}/board`,
    method: 'getBoard',
    status: 200,
    args: [workspaceId, userId],
    response: { workspaceId, activeWipLimit: 3, activeCount: 0, columns: [] },
  },
  {
    name: 'get task',
    verb: 'get',
    path: `/tasks/${taskId}`,
    method: 'findById',
    status: 200,
    args: [taskId, userId],
    response: task,
  },
  {
    name: 'update task',
    verb: 'patch',
    path: `/tasks/${taskId}`,
    method: 'update',
    status: 200,
    body: { position: 2 },
    args: [taskId, userId, { position: 2 }],
    response: { ...task, position: 2 },
  },
  {
    name: 'transition task',
    verb: 'post',
    path: `/tasks/${taskId}/transition`,
    method: 'transition',
    status: 201,
    body: { toStatus: TaskStatus.READY },
    args: [taskId, userId, { toStatus: TaskStatus.READY }],
    response: { ...task, status: TaskStatus.READY },
  },
  {
    name: 'delete task',
    verb: 'delete',
    path: `/tasks/${taskId}`,
    method: 'remove',
    status: 204,
    args: [taskId, userId],
    response: undefined,
  },
  {
    name: 'get assignment',
    verb: 'get',
    path: `/tasks/${taskId}/assignment`,
    method: 'getAssignment',
    status: 200,
    args: [taskId, userId],
    response: assignment,
  },
  {
    name: 'assign task',
    verb: 'post',
    path: `/tasks/${taskId}/assignment`,
    method: 'assign',
    status: 201,
    body: { userId: otherUserId },
    args: [taskId, userId, { userId: otherUserId }],
    response: assignment,
  },
  {
    name: 'unassign task',
    verb: 'delete',
    path: `/tasks/${taskId}/assignment`,
    method: 'unassign',
    status: 204,
    args: [taskId, userId],
    response: undefined,
  },
  {
    name: 'add comment',
    verb: 'post',
    path: `/tasks/${taskId}/comments`,
    method: 'addComment',
    status: 201,
    body: { content: 'Please review' },
    args: [taskId, userId, { content: 'Please review' }],
    response: comment,
  },
  {
    name: 'list comments',
    verb: 'get',
    path: `/tasks/${taskId}/comments`,
    method: 'listComments',
    status: 200,
    args: [taskId, userId],
    response: [comment],
  },
  {
    name: 'edit comment',
    verb: 'patch',
    path: `/tasks/${taskId}/comments/${commentId}`,
    method: 'updateComment',
    status: 200,
    body: { content: 'Edited' },
    args: [taskId, commentId, userId, { content: 'Edited' }],
    response: { ...comment, content: 'Edited' },
  },
  {
    name: 'delete comment',
    verb: 'delete',
    path: `/tasks/${taskId}/comments/${commentId}`,
    method: 'removeComment',
    status: 204,
    args: [taskId, commentId, userId],
    response: undefined,
  },
  {
    name: 'add dependency',
    verb: 'post',
    path: `/tasks/${taskId}/dependencies`,
    method: 'addDependency',
    status: 201,
    body: { dependsOnTaskId: otherTaskId },
    args: [taskId, userId, { dependsOnTaskId: otherTaskId }],
    response: dependency,
  },
  {
    name: 'list dependencies',
    verb: 'get',
    path: `/tasks/${taskId}/dependencies`,
    method: 'listDependencies',
    status: 200,
    args: [taskId, userId],
    response: [dependency],
  },
  {
    name: 'delete dependency',
    verb: 'delete',
    path: `/tasks/${taskId}/dependencies/${dependencyId}`,
    method: 'removeDependency',
    status: 204,
    args: [taskId, userId, dependencyId],
    response: undefined,
  },
  {
    name: 'block task',
    verb: 'post',
    path: `/tasks/${taskId}/block`,
    method: 'block',
    status: 200,
    body: { reason: 'Waiting for access' },
    args: [taskId, userId, { reason: 'Waiting for access' }],
    response: {
      ...task,
      isBlocked: true,
      blockedReason: 'Waiting for access',
      blockedAt: timestamp,
    },
  },
  {
    name: 'unblock task',
    verb: 'delete',
    path: `/tasks/${taskId}/block`,
    method: 'unblock',
    status: 200,
    args: [taskId, userId],
    response: task,
  },
];

describe('TasksController HTTP', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let token: string;
  let tasksService: Record<Method, jest.Mock>;
  const usersService = { findById: jest.fn() };

  beforeAll(async () => {
    tasksService = Object.fromEntries(
      methods.map((method) => [method, jest.fn()]),
    ) as Record<Method, jest.Mock>;
    jwt = new JwtService({
      secret: testSecret,
      signOptions: { expiresIn: '1h' },
    });
    token = jwt.sign({ sub: userId });

    const module = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        JwtAuthGuard,
        { provide: TasksService, useValue: tasksService },
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    usersService.findById.mockReset().mockResolvedValue(user);
    for (const route of routes) {
      tasksService[route.method].mockReset().mockResolvedValue(route.response);
    }
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  function send(
    verb: Verb,
    path: string,
    body?: Record<string, unknown>,
    bearer: string | null = token,
  ) {
    const call = request(app.getHttpServer())[verb](path);
    if (bearer !== null) call.set('Authorization', `Bearer ${bearer}`);
    if (body !== undefined) call.send(body);
    return call;
  }

  describe.each(routes)('$name', (route) => {
    it('calls the correct service method with the authenticated user and returns the response', async () => {
      const response = await send(route.verb, route.path, route.body).expect(
        route.status,
      );
      expect(tasksService[route.method]).toHaveBeenCalledTimes(1);
      expect(tasksService[route.method]).toHaveBeenCalledWith(...route.args);
      if (route.status === 204) {
        expect(response.text).toBe('');
      } else {
        expect(response.body).toEqual(route.response);
      }
    });

    it('rejects a request without a token before calling the service', async () => {
      await send(route.verb, route.path, route.body, null).expect(401);
      expect(tasksService[route.method]).not.toHaveBeenCalled();
    });

    it('rejects an invalid task or workspace UUID before calling the service', async () => {
      const invalidPath = route.path
        .replace(taskId, 'invalid-uuid')
        .replace(workspaceId, 'invalid-uuid');
      await send(route.verb, invalidPath, route.body).expect(400);
      expect(tasksService[route.method]).not.toHaveBeenCalled();
    });
  });

  describe('JWT authentication', () => {
    const path = `/tasks/${taskId}`;

    it('rejects a malformed token', async () => {
      await send('get', path, undefined, 'invalid').expect(401);
      expect(tasksService.findById).not.toHaveBeenCalled();
    });

    it('rejects the wrong authorization scheme', async () => {
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Basic ${token}`)
        .expect(401);
      expect(tasksService.findById).not.toHaveBeenCalled();
    });

    it('rejects a token signed with a different secret', async () => {
      const otherJwt = new JwtService({ secret: 'a-different-test-secret' });
      await send('get', path, undefined, otherJwt.sign({ sub: userId })).expect(
        401,
      );
      expect(tasksService.findById).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      const expired = jwt.sign({ sub: userId }, { expiresIn: -1 });
      await send('get', path, undefined, expired).expect(401);
      expect(tasksService.findById).not.toHaveBeenCalled();
    });

    it('rejects a token without a subject', async () => {
      await send('get', path, undefined, jwt.sign({})).expect(401);
      expect(tasksService.findById).not.toHaveBeenCalled();
    });

    it('rejects a token with a non-string subject', async () => {
      await send('get', path, undefined, jwt.sign({ sub: 123 })).expect(401);
      expect(tasksService.findById).not.toHaveBeenCalled();
    });

    it('rejects a token belonging to a user who no longer exists', async () => {
      usersService.findById.mockRejectedValueOnce(
        new NotFoundException('User not found'),
      );
      await send('get', path).expect(401);
      expect(tasksService.findById).not.toHaveBeenCalled();
    });

    it('rejects a disabled user', async () => {
      usersService.findById.mockResolvedValueOnce({
        ...user,
        status: UserStatus.DISABLED,
      });
      await send('get', path).expect(401);
      expect(tasksService.findById).not.toHaveBeenCalled();
    });
  });

  describe('task input validation', () => {
    it.each([0, 2])(
      'accepts position %i as a JSON number',
      async (position) => {
        await send('patch', `/tasks/${taskId}`, { position }).expect(200);
        expect(tasksService.update).toHaveBeenCalledWith(
          taskId,
          userId,
          expect.objectContaining({ position }),
        );
      },
    );

    it.each([
      ['negative', -1],
      ['decimal', 1.5],
      ['string', '2'],
      ['null', null],
    ])('rejects a %s position', async (_, position) => {
      await send('patch', `/tasks/${taskId}`, { position }).expect(400);
      expect(tasksService.update).not.toHaveBeenCalled();
    });

    it.each(['status', 'creatorId', 'workspaceId', 'isBlocked'])(
      'rejects the forbidden update field %s',
      async (field) => {
        await send('patch', `/tasks/${taskId}`, {
          [field]: 'forbidden',
        }).expect(400);
        expect(tasksService.update).not.toHaveBeenCalled();
      },
    );

    it('rejects a missing creation title', async () => {
      await send('post', `/workspaces/${workspaceId}/tasks`, {}).expect(400);
      expect(tasksService.create).not.toHaveBeenCalled();
    });

    it('rejects a numeric creation title', async () => {
      await send('post', `/workspaces/${workspaceId}/tasks`, {
        title: 123,
      }).expect(400);
      expect(tasksService.create).not.toHaveBeenCalled();
    });

    it('rejects a creation title exceeding the 200-character column', async () => {
      await send('post', `/workspaces/${workspaceId}/tasks`, {
        title: 'a'.repeat(201),
      }).expect(400);
      expect(tasksService.create).not.toHaveBeenCalled();
    });

    it('rejects a client-supplied creator ID', async () => {
      await send('post', `/workspaces/${workspaceId}/tasks`, {
        title: 'Task',
        creatorId: otherUserId,
      }).expect(400);
      expect(tasksService.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid priority', async () => {
      await send('patch', `/tasks/${taskId}`, { priority: 'INVALID' }).expect(
        400,
      );
      expect(tasksService.update).not.toHaveBeenCalled();
    });

    it('accepts a defined priority', async () => {
      await send('patch', `/tasks/${taskId}`, {
        priority: TaskPriority.HIGH,
      }).expect(200);
      expect(tasksService.update).toHaveBeenCalledWith(
        taskId,
        userId,
        expect.objectContaining({ priority: TaskPriority.HIGH }),
      );
    });

    it('rejects a malformed due date', async () => {
      await send('patch', `/tasks/${taskId}`, { dueAt: 'not-a-date' }).expect(
        400,
      );
      expect(tasksService.update).not.toHaveBeenCalled();
    });

    it('rejects an invalid transition status', async () => {
      await send('post', `/tasks/${taskId}/transition`, {
        toStatus: 'INVALID',
      }).expect(400);
      expect(tasksService.transition).not.toHaveBeenCalled();
    });

    it('rejects an invalid assignee UUID', async () => {
      await send('post', `/tasks/${taskId}/assignment`, {
        userId: 'invalid',
      }).expect(400);
      expect(tasksService.assign).not.toHaveBeenCalled();
    });
  });

  describe('dependency input validation', () => {
    it.each([
      ['missing', {}],
      ['null', { dependsOnTaskId: null }],
      ['numeric', { dependsOnTaskId: 123 }],
      ['invalid UUID', { dependsOnTaskId: 'invalid' }],
    ] as Array<[string, Record<string, unknown>]>)(
      'rejects a %s prerequisite',
      async (_, body) => {
        await send('post', `/tasks/${taskId}/dependencies`, body).expect(400);
        expect(tasksService.addDependency).not.toHaveBeenCalled();
      },
    );

    it('rejects an invalid dependency record UUID in the deletion path', async () => {
      await send('delete', `/tasks/${taskId}/dependencies/invalid`).expect(400);
      expect(tasksService.removeDependency).not.toHaveBeenCalled();
    });
  });

  describe('comment input validation', () => {
    it('rejects a missing comment body', async () => {
      await send('post', `/tasks/${taskId}/comments`, {}).expect(400);
      expect(tasksService.addComment).not.toHaveBeenCalled();
    });

    it('rejects numeric comment content', async () => {
      await send('post', `/tasks/${taskId}/comments`, { content: 123 }).expect(
        400,
      );
      expect(tasksService.addComment).not.toHaveBeenCalled();
    });

    it('rejects an invalid comment UUID when editing', async () => {
      await send('patch', `/tasks/${taskId}/comments/invalid`, {
        content: 'Edited',
      }).expect(400);
      expect(tasksService.updateComment).not.toHaveBeenCalled();
    });

    it('rejects an invalid comment UUID when deleting', async () => {
      await send('delete', `/tasks/${taskId}/comments/invalid`).expect(400);
      expect(tasksService.removeComment).not.toHaveBeenCalled();
    });
  });

  describe('block input validation', () => {
    it.each([
      ['missing', {}],
      ['null', { reason: null }],
      ['numeric', { reason: 123 }],
      ['empty', { reason: '' }],
    ] as Array<[string, Record<string, unknown>]>)(
      'rejects a %s block reason',
      async (_, body) => {
        await send('post', `/tasks/${taskId}/block`, body).expect(400);
        expect(tasksService.block).not.toHaveBeenCalled();
      },
    );
  });

  describe('service exceptions become HTTP responses', () => {
    it('returns 404 when the service cannot find the task', async () => {
      tasksService.findById.mockRejectedValueOnce(
        new NotFoundException('Task not found'),
      );
      const response = await send('get', `/tasks/${taskId}`).expect(404);
      expect(response.body.message).toBe('Task not found');
    });

    it('returns 403 when the service rejects workspace access', async () => {
      tasksService.findById.mockRejectedValueOnce(new ForbiddenException());
      await send('get', `/tasks/${taskId}`).expect(403);
    });

    it('returns 409 when the service rejects a duplicate block', async () => {
      tasksService.block.mockRejectedValueOnce(
        new ConflictException('Task is already blocked'),
      );
      const response = await send('post', `/tasks/${taskId}/block`, {
        reason: 'Waiting',
      }).expect(409);
      expect(response.body.message).toBe('Task is already blocked');
    });
  });
});

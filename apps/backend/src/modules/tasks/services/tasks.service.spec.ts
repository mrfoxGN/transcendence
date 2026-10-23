import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';

// These unit tests do not start Nest or connect to MySQL.
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

// Keep the real cross-domain services outside this unit test.
jest.mock('../../users/services/users.service', () => ({
  UsersService: class UsersService {},
}));
jest.mock('../../workspaces/services/workspaces.service', () => ({
  WorkspacesService: class WorkspacesService {},
}));

import {
  TaskPriority,
  TaskStatus,
  UserStatus,
} from '../../../database/enums/database.enums';
import type { UsersService } from '../../users/services/users.service';
import type { WorkspacesService } from '../../workspaces/services/workspaces.service';
import { Task } from '../entities/task.entity';
import { TaskAssignment } from '../entities/task-assignment.entity';
import { TaskComment } from '../entities/task-comment.entity';
import { TaskDependency } from '../entities/task-dependency.entity';
import { TaskStatusHistory } from '../entities/task-status-history.entity';
import { TasksService } from './tasks.service';

const taskId = '11111111-1111-4111-8111-111111111111';
const otherTaskId = '22222222-2222-4222-8222-222222222222';
const thirdTaskId = '33333333-3333-4333-8333-333333333333';
const workspaceId = '44444444-4444-4444-8444-444444444444';
const userId = '55555555-5555-4555-8555-555555555555';
const otherUserId = '66666666-6666-4666-8666-666666666666';
const dependencyId = '77777777-7777-4777-8777-777777777777';
const commentId = '88888888-8888-4888-8888-888888888888';
const date = new Date('2026-10-23T12:00:00.000Z');

function makeTask(overrides: Partial<Task> = {}): Task {
  return Object.assign(new Task(), {
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
    createdAt: date,
    updatedAt: date,
    completedAt: null,
    cancelledAt: null,
    deletedAt: null,
    ...overrides,
  });
}

function makeRepository() {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn((value: object) => ({ ...value })),
    save: jest.fn(async (value: object) => value),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(),
  };
}

describe('TasksService', () => {
  let service: TasksService;
  let task: Task;
  let tasks: ReturnType<typeof makeRepository>;
  let transactionTasks: ReturnType<typeof makeRepository>;
  let assignments: ReturnType<typeof makeRepository>;
  let comments: ReturnType<typeof makeRepository>;
  let dependencies: ReturnType<typeof makeRepository>;
  let history: ReturnType<typeof makeRepository>;
  let workspaces: {
    findOneForUser: jest.Mock;
    getKanbanSettings: jest.Mock;
  };
  let users: { findById: jest.Mock };
  let dataSource: { getRepository: jest.Mock; transaction: jest.Mock };
  let query: {
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    setLock: jest.Mock;
    getMany: jest.Mock;
  };

  beforeEach(() => {
    task = makeTask();
    tasks = makeRepository();
    transactionTasks = makeRepository();
    assignments = makeRepository();
    comments = makeRepository();
    dependencies = makeRepository();
    history = makeRepository();

    tasks.findOne.mockResolvedValue(task);
    transactionTasks.findOne.mockResolvedValue(task);

    query = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([task]),
    };
    transactionTasks.createQueryBuilder.mockReturnValue(query);

    workspaces = {
      findOneForUser: jest.fn().mockResolvedValue({ id: workspaceId }),
      getKanbanSettings: jest.fn().mockResolvedValue({ activeWipLimit: 3 }),
    };
    users = {
      findById: jest
        .fn()
        .mockResolvedValue({ id: otherUserId, status: UserStatus.ACTIVE }),
    };

    const repositories = new Map<Function, ReturnType<typeof makeRepository>>([
      [Task, transactionTasks],
      [TaskAssignment, assignments],
      [TaskComment, comments],
      [TaskDependency, dependencies],
      [TaskStatusHistory, history],
    ]);
    const manager = {
      getRepository: jest.fn((entity: Function) => {
        const repository = repositories.get(entity);
        if (!repository) {
          throw new Error('Unexpected repository requested by the service');
        }
        return repository;
      }),
    };
    dataSource = {
      getRepository: manager.getRepository,
      // Invoking the callback tests transaction logic, not actual MySQL rollback.
      transaction: jest.fn(
        async (callback: (manager: unknown) => Promise<unknown>) =>
          callback(manager),
      ),
    };

    service = new TasksService(
      tasks as unknown as Repository<Task>,
      workspaces as unknown as WorkspacesService,
      users as unknown as UsersService,
      dataSource as unknown as DataSource,
    );
  });

  // Run the same access checks against every task-scoped service method.
  const protectedOperations: Array<[string, () => Promise<unknown>]> = [
    ['findById', () => service.findById(taskId, userId)],
    ['update', () => service.update(taskId, userId, { title: 'New title' })],
    [
      'transition',
      () => service.transition(taskId, userId, { toStatus: TaskStatus.READY }),
    ],
    ['remove', () => service.remove(taskId, userId)],
    ['assign', () => service.assign(taskId, userId, { userId: otherUserId })],
    ['getAssignment', () => service.getAssignment(taskId, userId)],
    ['unassign', () => service.unassign(taskId, userId)],
    [
      'addComment',
      () => service.addComment(taskId, userId, { content: 'Hello' }),
    ],
    [
      'updateComment',
      () =>
        service.updateComment(taskId, commentId, userId, { content: 'Edited' }),
    ],
    ['listComments', () => service.listComments(taskId, userId)],
    ['removeComment', () => service.removeComment(taskId, commentId, userId)],
    [
      'addDependency',
      () =>
        service.addDependency(taskId, userId, { dependsOnTaskId: otherTaskId }),
    ],
    ['listDependencies', () => service.listDependencies(taskId, userId)],
    [
      'removeDependency',
      () => service.removeDependency(taskId, userId, dependencyId),
    ],
    [
      'block',
      () => service.block(taskId, userId, { reason: 'Waiting for access' }),
    ],
    ['unblock', () => service.unblock(taskId, userId)],
  ];

  describe('shared access checks', () => {
    it.each(protectedOperations)(
      '%s rejects a missing or deleted task',
      async (_, run) => {
        tasks.findOne.mockResolvedValue(null);
        await expect(run()).rejects.toThrow(NotFoundException);
        expect(dataSource.transaction).not.toHaveBeenCalled();
        expect(tasks.update).not.toHaveBeenCalled();
        expect(dependencies.delete).not.toHaveBeenCalled();
      },
    );

    it.each(protectedOperations)(
      '%s rejects a workspace non-member before writing',
      async (_, run) => {
        workspaces.findOneForUser.mockRejectedValue(new ForbiddenException());
        await expect(run()).rejects.toThrow(ForbiddenException);
        expect(dataSource.transaction).not.toHaveBeenCalled();
        expect(tasks.update).not.toHaveBeenCalled();
        expect(dependencies.delete).not.toHaveBeenCalled();
      },
    );
  });

  describe('creation and reading', () => {
    it('creates a BACKLOG task using the authenticated creator and safe defaults', async () => {
      const result = await service.create(workspaceId, userId, {
        title: '  Build profile  ',
      });
      expect(workspaces.findOneForUser).toHaveBeenCalledWith(
        workspaceId,
        userId,
      );
      expect(tasks.save).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          creatorId: userId,
          title: 'Build profile',
          status: TaskStatus.BACKLOG,
          position: 0,
          isBlocked: false,
          deletedAt: null,
        }),
      );
      expect(result.title).toBe('Build profile');
      expect(result).not.toHaveProperty('deletedAt');
    });

    it('rejects a spaces-only task title', async () => {
      await expect(
        service.create(workspaceId, userId, { title: '   ' }),
      ).rejects.toThrow(BadRequestException);
      expect(tasks.save).not.toHaveBeenCalled();
    });

    it('does not create a task for a workspace non-member', async () => {
      workspaces.findOneForUser.mockRejectedValue(new ForbiddenException());
      await expect(
        service.create(workspaceId, userId, { title: 'Task' }),
      ).rejects.toThrow(ForbiddenException);
      expect(tasks.save).not.toHaveBeenCalled();
    });

    it('returns a safe task response after checking workspace access', async () => {
      const result = await service.findById(taskId, userId);
      expect(workspaces.findOneForUser).toHaveBeenCalledWith(
        workspaceId,
        userId,
      );
      expect(result.id).toBe(taskId);
      expect(result).not.toHaveProperty('deletedAt');
    });
  });

  describe('updates and soft deletion', () => {
    it('rejects an empty update', async () => {
      await expect(service.update(taskId, userId, {})).rejects.toThrow(
        'No changes provided',
      );
      expect(tasks.update).not.toHaveBeenCalled();
    });

    it('rejects a spaces-only updated title', async () => {
      await expect(
        service.update(taskId, userId, { title: '   ' }),
      ).rejects.toThrow('Task title is required');
      expect(tasks.update).not.toHaveBeenCalled();
    });

    it('trims the title, converts the due date, and preserves omitted fields', async () => {
      const dueAt = '2026-12-01T10:00:00.000Z';
      await service.update(taskId, userId, { title: '  Updated  ', dueAt });
      const changes = tasks.update.mock.calls[0][1];
      expect(changes).toEqual({
        title: 'Updated',
        dueAt: new Date(dueAt),
        updatedAt: expect.any(Date),
      });
    });

    it('allows nullable task fields to be cleared', async () => {
      await service.update(taskId, userId, {
        description: null,
        acceptanceCriteria: null,
        priority: null,
        dueAt: null,
      });
      expect(tasks.update).toHaveBeenCalledWith(expect.anything(), {
        description: null,
        acceptanceCriteria: null,
        priority: null,
        dueAt: null,
        updatedAt: expect.any(Date),
      });
    });

    it('updates task priority', async () => {
      await service.update(taskId, userId, { priority: TaskPriority.HIGH });
      expect(tasks.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ priority: TaskPriority.HIGH }),
      );
    });

    it.each([0, 2])(
      'accepts a position-only update with position %i',
      async (position) => {
        tasks.findOne
          .mockResolvedValueOnce(task)
          .mockResolvedValueOnce(makeTask({ position }));
        const result = await service.update(taskId, userId, { position });
        expect(tasks.update).toHaveBeenCalledWith(expect.anything(), {
          position,
          updatedAt: expect.any(Date),
        });
        expect(result.position).toBe(position);
      },
    );

    it('returns 404 if the task disappears before the update', async () => {
      tasks.update.mockResolvedValue({ affected: 0 });
      await expect(
        service.update(taskId, userId, { title: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns 404 if the task disappears before the response read', async () => {
      tasks.findOne.mockResolvedValueOnce(task).mockResolvedValueOnce(null);
      await expect(
        service.update(taskId, userId, { title: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates unexpected database errors', async () => {
      const error = new Error('Database unavailable');
      tasks.update.mockRejectedValue(error);
      await expect(
        service.update(taskId, userId, { title: 'Updated' }),
      ).rejects.toBe(error);
    });

    it('soft-deletes a task instead of physically deleting it', async () => {
      await service.remove(taskId, userId);
      expect(tasks.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: taskId }),
        {
          deletedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      );
      expect(tasks.delete).not.toHaveBeenCalled();
    });

    it('returns 404 when a concurrent request already deleted the task', async () => {
      tasks.update.mockResolvedValue({ affected: 0 });
      await expect(service.remove(taskId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('board and WIP', () => {
    it('groups every status and counts blocked active tasks toward WIP', async () => {
      tasks.find.mockResolvedValue([
        makeTask(),
        makeTask({
          id: otherTaskId,
          status: TaskStatus.IN_PROGRESS,
          isBlocked: true,
        }),
        makeTask({ id: thirdTaskId, status: TaskStatus.REVIEW }),
        makeTask({ id: 'done-task', status: TaskStatus.DONE }),
      ]);
      const board = await service.getBoard(workspaceId, userId);
      expect(board.activeWipLimit).toBe(3);
      expect(board.activeCount).toBe(2);
      expect(board.columns.map((column) => column.status)).toEqual(
        Object.values(TaskStatus),
      );
      expect(
        board.columns.find((column) => column.status === TaskStatus.IN_PROGRESS)
          ?.tasks[0].isBlocked,
      ).toBe(true);
      expect(tasks.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId,
            deletedAt: expect.anything(),
          }),
          order: { position: 'ASC', createdAt: 'ASC', id: 'ASC' },
        }),
      );
    });

    it('returns all empty columns for an empty workspace', async () => {
      const board = await service.getBoard(workspaceId, userId);
      expect(board.activeCount).toBe(0);
      expect(board.columns.every((column) => column.tasks.length === 0)).toBe(
        true,
      );
    });

    it('does not read tasks when workspace access is rejected', async () => {
      workspaces.getKanbanSettings.mockRejectedValue(new ForbiddenException());
      await expect(service.getBoard(workspaceId, userId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(tasks.find).not.toHaveBeenCalled();
    });
  });

  describe('status transitions', () => {
    const allowed: Array<[TaskStatus, TaskStatus]> = [
      [TaskStatus.BACKLOG, TaskStatus.READY],
      [TaskStatus.BACKLOG, TaskStatus.CANCELLED],
      [TaskStatus.READY, TaskStatus.BACKLOG],
      [TaskStatus.READY, TaskStatus.IN_PROGRESS],
      [TaskStatus.READY, TaskStatus.CANCELLED],
      [TaskStatus.IN_PROGRESS, TaskStatus.REVIEW],
      [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
      [TaskStatus.REVIEW, TaskStatus.IN_PROGRESS],
      [TaskStatus.REVIEW, TaskStatus.DONE],
      [TaskStatus.REVIEW, TaskStatus.CANCELLED],
    ];

    it.each(allowed)(
      'moves %s to %s and records the actor and history',
      async (from, to) => {
        task.status = from;
        const result = await service.transition(taskId, userId, {
          toStatus: to,
          note: 'Reviewed',
        });
        expect(result.status).toBe(to);
        expect(dataSource.transaction).toHaveBeenCalledTimes(1);
        expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
        expect(history.save).toHaveBeenCalledWith(
          expect.objectContaining({
            taskId,
            fromStatus: from,
            toStatus: to,
            changedById: userId,
            changedAt: expect.any(Date),
            note: 'Reviewed',
          }),
        );
        if (to === TaskStatus.DONE)
          expect(result.completedAt).toEqual(expect.any(Date));
        if (to === TaskStatus.CANCELLED)
          expect(result.cancelledAt).toEqual(expect.any(Date));
      },
    );

    const allTransitions = Object.values(TaskStatus).flatMap((from) =>
      Object.values(TaskStatus).map((to): [TaskStatus, TaskStatus] => [
        from,
        to,
      ]),
    );
    const forbidden = allTransitions.filter(
      ([from, to]) =>
        !allowed.some(
          ([allowedFrom, allowedTo]) =>
            from === allowedFrom && to === allowedTo,
        ),
    );

    it.each(forbidden)(
      'rejects the forbidden transition %s to %s',
      async (from, to) => {
        task.status = from;
        await expect(
          service.transition(taskId, userId, { toStatus: to }),
        ).rejects.toThrow(BadRequestException);
        expect(transactionTasks.save).not.toHaveBeenCalled();
        expect(history.save).not.toHaveBeenCalled();
      },
    );

    it('rejects READY to IN_PROGRESS when active WIP is full', async () => {
      task.status = TaskStatus.READY;
      transactionTasks.count.mockResolvedValue(3);
      await expect(
        service.transition(taskId, userId, {
          toStatus: TaskStatus.IN_PROGRESS,
        }),
      ).rejects.toThrow('Active WIP limit reached');
      expect(transactionTasks.save).not.toHaveBeenCalled();
      expect(history.save).not.toHaveBeenCalled();
    });

    it('allows REVIEW to IN_PROGRESS while WIP is full because the task is already active', async () => {
      task.status = TaskStatus.REVIEW;
      transactionTasks.count.mockResolvedValue(3);
      const result = await service.transition(taskId, userId, {
        toStatus: TaskStatus.IN_PROGRESS,
      });
      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
      expect(transactionTasks.count).not.toHaveBeenCalled();
    });

    it('returns 404 if the task disappears before the transaction locks it', async () => {
      query.getMany.mockResolvedValue([]);
      await expect(
        service.transition(taskId, userId, { toStatus: TaskStatus.READY }),
      ).rejects.toThrow(NotFoundException);
      expect(transactionTasks.save).not.toHaveBeenCalled();
    });

    it('propagates a history insert failure out of the transaction callback', async () => {
      const error = new Error('History insert failed');
      history.save.mockRejectedValue(error);
      await expect(
        service.transition(taskId, userId, { toStatus: TaskStatus.READY }),
      ).rejects.toBe(error);
      // A separate real-database test is required to prove rollback.
    });
  });

  describe('assignment', () => {
    it('assigns an active workspace member and records who assigned them', async () => {
      const result = await service.assign(taskId, userId, {
        userId: otherUserId,
      });
      expect(workspaces.findOneForUser).toHaveBeenCalledWith(
        workspaceId,
        otherUserId,
      );
      expect(assignments.save).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId,
          userId: otherUserId,
          assignedById: userId,
          assignedAt: expect.any(Date),
        }),
      );
      expect(result.userId).toBe(otherUserId);
    });

    it('rejects an inactive assignee', async () => {
      users.findById.mockResolvedValue({ status: UserStatus.DISABLED });
      await expect(
        service.assign(taskId, userId, { userId: otherUserId }),
      ).rejects.toThrow('Assignee must be active');
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects an assignee outside the workspace', async () => {
      workspaces.findOneForUser
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new ForbiddenException());
      await expect(
        service.assign(taskId, userId, { userId: otherUserId }),
      ).rejects.toThrow('Assignee must belong to the workspace');
      expect(assignments.save).not.toHaveBeenCalled();
    });

    it('rejects a missing assignee', async () => {
      users.findById.mockRejectedValue(new NotFoundException('User not found'));
      await expect(
        service.assign(taskId, userId, { userId: otherUserId }),
      ).rejects.toThrow(NotFoundException);
      expect(assignments.save).not.toHaveBeenCalled();
    });

    it('rejects a second assignment', async () => {
      assignments.findOne.mockResolvedValue({ taskId, userId });
      await expect(
        service.assign(taskId, userId, { userId: otherUserId }),
      ).rejects.toThrow(ConflictException);
      expect(assignments.save).not.toHaveBeenCalled();
    });

    it('returns null when there is no assignment', async () => {
      await expect(service.getAssignment(taskId, userId)).resolves.toBeNull();
    });

    it('returns the existing assignment', async () => {
      assignments.findOne.mockResolvedValue({
        id: 'assignment',
        taskId,
        userId: otherUserId,
        assignedById: userId,
        assignedAt: date,
      });
      const result = await service.getAssignment(taskId, userId);
      expect(result?.userId).toBe(otherUserId);
    });

    it('removes an assignment inside a transaction', async () => {
      await service.unassign(taskId, userId);
      expect(assignments.delete).toHaveBeenCalledWith({ taskId });
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('returns 404 when unassigning an unassigned task', async () => {
      assignments.delete.mockResolvedValue({ affected: 0 });
      await expect(service.unassign(taskId, userId)).rejects.toThrow(
        'Task assignment not found',
      );
    });
  });

  describe('comments', () => {
    function makeComment(authorId: string | null = userId) {
      return {
        id: commentId,
        taskId,
        authorId,
        content: 'Original',
        createdAt: date,
        updatedAt: date,
        editedAt: null,
        deletedAt: null,
      };
    }

    it('trims a new comment and derives its author from the authenticated user', async () => {
      const result = await service.addComment(taskId, userId, {
        content: '  Hello  ',
      });
      expect(comments.save).toHaveBeenCalledWith(
        expect.objectContaining({ taskId, authorId: userId, content: 'Hello' }),
      );
      expect(result.content).toBe('Hello');
      expect(result).not.toHaveProperty('deletedAt');
    });

    it('rejects a spaces-only new comment', async () => {
      await expect(
        service.addComment(taskId, userId, { content: '   ' }),
      ).rejects.toThrow(BadRequestException);
      expect(comments.save).not.toHaveBeenCalled();
    });

    it('rejects a spaces-only comment edit', async () => {
      await expect(
        service.updateComment(taskId, commentId, userId, { content: '   ' }),
      ).rejects.toThrow(BadRequestException);
      expect(comments.save).not.toHaveBeenCalled();
    });

    it('allows the author to edit a comment and records the edit time', async () => {
      comments.findOne.mockResolvedValue(makeComment());
      const result = await service.updateComment(taskId, commentId, userId, {
        content: '  Edited  ',
      });
      expect(result.content).toBe('Edited');
      expect(result.editedAt).toEqual(expect.any(Date));
      expect(comments.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: commentId,
            taskId,
            deletedAt: expect.anything(),
          }),
        }),
      );
    });

    it("rejects editing another user's comment", async () => {
      comments.findOne.mockResolvedValue(makeComment(otherUserId));
      await expect(
        service.updateComment(taskId, commentId, userId, { content: 'Edited' }),
      ).rejects.toThrow(ForbiddenException);
      expect(comments.save).not.toHaveBeenCalled();
    });

    it('returns 404 for an edit of a missing, deleted, or differently scoped comment', async () => {
      await expect(
        service.updateComment(taskId, commentId, userId, { content: 'Edited' }),
      ).rejects.toThrow('Comment not found');
      expect(comments.save).not.toHaveBeenCalled();
    });

    it('lists live comments in chronological order and returns safe responses', async () => {
      comments.find.mockResolvedValue([makeComment()]);
      const result = await service.listComments(taskId, userId);
      expect(comments.find).toHaveBeenCalledWith({
        where: { taskId, deletedAt: expect.anything() },
        order: { createdAt: 'ASC', id: 'ASC' },
      });
      expect(result[0].id).toBe(commentId);
      expect(result[0]).not.toHaveProperty('deletedAt');
    });

    it("soft-deletes an author's own comment", async () => {
      comments.findOne.mockResolvedValue(makeComment());
      await service.removeComment(taskId, commentId, userId);
      expect(comments.save).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );
      expect(comments.delete).not.toHaveBeenCalled();
    });

    it("rejects deleting another user's comment", async () => {
      comments.findOne.mockResolvedValue(makeComment(otherUserId));
      await expect(
        service.removeComment(taskId, commentId, userId),
      ).rejects.toThrow(ForbiddenException);
      expect(comments.save).not.toHaveBeenCalled();
    });

    it('returns 404 when deleting a missing comment', async () => {
      await expect(
        service.removeComment(taskId, commentId, userId),
      ).rejects.toThrow('Comment not found');
    });
  });

  describe('dependencies', () => {
    function link(from: string, to: string) {
      return {
        id: dependencyId,
        taskId: from,
        dependsOnTaskId: to,
        createdById: userId,
        createdAt: date,
      };
    }

    beforeEach(() => {
      query.getMany.mockResolvedValue([
        task,
        makeTask({ id: otherTaskId }),
        makeTask({ id: thirdTaskId }),
      ]);
    });

    it('creates a dependency between live tasks in the same workspace', async () => {
      const result = await service.addDependency(taskId, userId, {
        dependsOnTaskId: otherTaskId,
      });
      expect(result.taskId).toBe(taskId);
      expect(result.dependsOnTaskId).toBe(otherTaskId);
      expect(result.createdById).toBe(userId);
      expect(query.where).toHaveBeenCalledWith(
        'task.workspaceId = :workspaceId',
        { workspaceId },
      );
      expect(query.andWhere).toHaveBeenCalledWith('task.deletedAt IS NULL');
      expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
    });

    it('rejects self-dependency', async () => {
      await expect(
        service.addDependency(taskId, userId, { dependsOnTaskId: taskId }),
      ).rejects.toThrow(BadRequestException);
      expect(dependencies.save).not.toHaveBeenCalled();
    });

    it('rejects a prerequisite absent from the live workspace task set', async () => {
      query.getMany.mockResolvedValue([task]);
      await expect(
        service.addDependency(taskId, userId, { dependsOnTaskId: otherTaskId }),
      ).rejects.toThrow('Dependency task not found in this workspace');
      expect(dependencies.save).not.toHaveBeenCalled();
    });

    it('rejects an existing link', async () => {
      dependencies.find.mockResolvedValue([link(taskId, otherTaskId)]);
      await expect(
        service.addDependency(taskId, userId, { dependsOnTaskId: otherTaskId }),
      ).rejects.toThrow(ConflictException);
      expect(dependencies.save).not.toHaveBeenCalled();
    });

    it('rejects a two-task cycle', async () => {
      dependencies.find.mockResolvedValue([link(otherTaskId, taskId)]);
      await expect(
        service.addDependency(taskId, userId, { dependsOnTaskId: otherTaskId }),
      ).rejects.toThrow('Dependency would create a cycle');
      expect(dependencies.save).not.toHaveBeenCalled();
    });

    it('rejects an indirect cycle through a third task', async () => {
      dependencies.find.mockResolvedValue([
        link(otherTaskId, thirdTaskId),
        link(thirdTaskId, taskId),
      ]);
      await expect(
        service.addDependency(taskId, userId, { dependsOnTaskId: otherTaskId }),
      ).rejects.toThrow('Dependency would create a cycle');
      expect(dependencies.save).not.toHaveBeenCalled();
    });

    it('allows a chain that does not return to the starting task', async () => {
      dependencies.find.mockResolvedValue([link(otherTaskId, thirdTaskId)]);
      await expect(
        service.addDependency(taskId, userId, { dependsOnTaskId: otherTaskId }),
      ).resolves.toMatchObject({ taskId, dependsOnTaskId: otherTaskId });
    });

    it('returns 404 if the task disappears before it is locked', async () => {
      query.getMany.mockResolvedValue([makeTask({ id: otherTaskId })]);
      await expect(
        service.addDependency(taskId, userId, { dependsOnTaskId: otherTaskId }),
      ).rejects.toThrow('Task not found');
      expect(dependencies.save).not.toHaveBeenCalled();
    });

    it('lists dependency records in a stable order', async () => {
      dependencies.find.mockResolvedValue([link(taskId, otherTaskId)]);
      const result = await service.listDependencies(taskId, userId);
      expect(result[0].dependsOnTaskId).toBe(otherTaskId);
      expect(dependencies.find).toHaveBeenCalledWith({
        where: { taskId },
        order: { createdAt: 'ASC', id: 'ASC' },
      });
    });

    it('returns an empty dependency list when there are no links', async () => {
      await expect(service.listDependencies(taskId, userId)).resolves.toEqual(
        [],
      );
    });

    it('deletes only a dependency belonging to the requested task', async () => {
      await service.removeDependency(taskId, userId, dependencyId);
      expect(dependencies.delete).toHaveBeenCalledWith({
        id: dependencyId,
        taskId,
      });
    });

    it('returns 404 when the link is absent or belongs to another task', async () => {
      dependencies.delete.mockResolvedValue({ affected: 0 });
      await expect(
        service.removeDependency(taskId, userId, dependencyId),
      ).rejects.toThrow('Task dependency not found');
    });
  });

  describe('blocking', () => {
    it('trims and saves the block reason without changing status', async () => {
      task.status = TaskStatus.IN_PROGRESS;
      tasks.findOne.mockResolvedValueOnce(task).mockResolvedValueOnce(
        makeTask({
          status: TaskStatus.IN_PROGRESS,
          isBlocked: true,
          blockedReason: 'Waiting for access',
          blockedAt: date,
        }),
      );
      const result = await service.block(taskId, userId, {
        reason: '  Waiting for access  ',
      });
      const [criteria, changes] = tasks.update.mock.calls[0];
      expect(criteria).toEqual(
        expect.objectContaining({
          id: taskId,
          isBlocked: false,
          deletedAt: expect.anything(),
        }),
      );
      expect(changes).toEqual({
        isBlocked: true,
        blockedReason: 'Waiting for access',
        blockedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(result.isBlocked).toBe(true);
      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('rejects a spaces-only block reason', async () => {
      await expect(
        service.block(taskId, userId, { reason: '   ' }),
      ).rejects.toThrow(BadRequestException);
      expect(tasks.update).not.toHaveBeenCalled();
    });

    it('returns 409 when the task is already blocked', async () => {
      tasks.findOne.mockResolvedValue(makeTask({ isBlocked: true }));
      tasks.update.mockResolvedValue({ affected: 0 });
      await expect(
        service.block(taskId, userId, { reason: 'Another reason' }),
      ).rejects.toThrow('Task is already blocked');
    });

    it('returns 404 if the task is deleted before the block update', async () => {
      tasks.findOne.mockResolvedValueOnce(task).mockResolvedValueOnce(null);
      tasks.update.mockResolvedValue({ affected: 0 });
      await expect(
        service.block(taskId, userId, { reason: 'Waiting' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('clears the block fields without changing status', async () => {
      tasks.findOne
        .mockResolvedValueOnce(
          makeTask({
            status: TaskStatus.IN_PROGRESS,
            isBlocked: true,
            blockedReason: 'Waiting',
            blockedAt: date,
          }),
        )
        .mockResolvedValueOnce(makeTask({ status: TaskStatus.IN_PROGRESS }));
      const result = await service.unblock(taskId, userId);
      expect(tasks.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: taskId, isBlocked: true }),
        {
          isBlocked: false,
          blockedReason: null,
          blockedAt: null,
          updatedAt: expect.any(Date),
        },
      );
      expect(result.isBlocked).toBe(false);
      expect(result.blockedReason).toBeNull();
      expect(result.blockedAt).toBeNull();
      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('returns 409 when the task is already unblocked', async () => {
      tasks.update.mockResolvedValue({ affected: 0 });
      await expect(service.unblock(taskId, userId)).rejects.toThrow(
        'Task is not blocked',
      );
    });

    it('returns 404 if the task is deleted before the unblock update', async () => {
      tasks.findOne.mockResolvedValueOnce(task).mockResolvedValueOnce(null);
      tasks.update.mockResolvedValue({ affected: 0 });
      await expect(service.unblock(taskId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deletion while waiting for a task lock', () => {
    const operations: Array<[string, () => Promise<unknown>]> = [
      ['assign', () => service.assign(taskId, userId, { userId: otherUserId })],
      ['unassign', () => service.unassign(taskId, userId)],
      [
        'addComment',
        () => service.addComment(taskId, userId, { content: 'Hello' }),
      ],
      [
        'updateComment',
        () =>
          service.updateComment(taskId, commentId, userId, {
            content: 'Edited',
          }),
      ],
      ['removeComment', () => service.removeComment(taskId, commentId, userId)],
    ];

    it.each(operations)(
      '%s rechecks that the locked task still exists',
      async (_, run) => {
        transactionTasks.findOne.mockResolvedValue(null);
        await expect(run()).rejects.toThrow(NotFoundException);
        expect(assignments.save).not.toHaveBeenCalled();
        expect(assignments.delete).not.toHaveBeenCalled();
        expect(comments.save).not.toHaveBeenCalled();
      },
    );
  });
});

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, In, IsNull, Repository } from 'typeorm';

import {
  TaskStatus,
  UserStatus,
} from '../../../database/enums/database.enums';
import { UsersService } from '../../users/services/users.service';
import { WorkspacesService } from '../../workspaces/services/workspaces.service';
import { AssignTaskDto } from '../dto/assign-task.dto';
import { CreateTaskDto } from '../dto/create-task.dto';
import { TaskAssignmentResponseDto } from '../dto/task-assignment-response.dto';
import { TaskBoardResponseDto } from '../dto/task-board-response.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { TransitionTaskDto } from '../dto/transition-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { TaskAssignment } from '../entities/task-assignment.entity';
import { TaskStatusHistory } from '../entities/task-status-history.entity';
import { Task } from '../entities/task.entity';
import { TaskAssignmentMapper } from '../mappers/task-assignment.mapper';
import { TaskMapper } from '../mappers/task.mapper';
import { CreateTaskCommentDto } from '../dto/create-task-comment.dto';
import { TaskCommentResponseDto } from '../dto/task-comment-response.dto';
import { TaskComment } from '../entities/task-comment.entity';
import { TaskCommentMapper } from '../mappers/task-comment.mapper';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    private readonly workspacesService: WorkspacesService,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateTaskDto,
  ): Promise<TaskResponseDto> {
    const title = dto.title.trim();

    if (!title) {
      throw new BadRequestException('Task title is required');
    }

    await this.workspacesService.findOneForUser(workspaceId, userId);

    const now = new Date();

    const task = this.tasksRepository.create({
      id: randomUUID(),
      workspaceId,
      creatorId: userId,
      title,
      description: dto.description ?? null,
      acceptanceCriteria: dto.acceptanceCriteria ?? null,
      status: TaskStatus.BACKLOG,
      priority: dto.priority ?? null,
      position: 0,
      isBlocked: false,
      blockedReason: null,
      blockedAt: null,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      cancelledAt: null,
      deletedAt: null,
    });

    const savedTask = await this.tasksRepository.save(task);
    return TaskMapper.toResponse(savedTask);
  }

  async getBoard(
    workspaceId: string,
    userId: string,
  ): Promise<TaskBoardResponseDto> {
    const settings = await this.workspacesService.getKanbanSettings(
      workspaceId,
      userId,
    );

    const tasks = await this.tasksRepository.find({
      where: {
        workspaceId,
        deletedAt: IsNull(),
      },
      order: {
        position: 'ASC',
        createdAt: 'ASC',
        id: 'ASC',
      },
    });

    const activeCount = tasks.filter(
      (task) =>
        task.status === TaskStatus.IN_PROGRESS ||
        task.status === TaskStatus.REVIEW,
    ).length;

    const columns = Object.values(TaskStatus).map((status) => ({
      status,
      tasks: tasks
        .filter((task) => task.status === status)
        .map((task) => TaskMapper.toResponse(task)),
    }));

    return {
      workspaceId,
      activeWipLimit: settings.activeWipLimit,
      activeCount,
      columns,
    };
  }

  async findById(
    taskId: string,
    userId: string,
  ): Promise<TaskResponseDto> {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId, deletedAt: IsNull() },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.workspacesService.findOneForUser(task.workspaceId, userId);

    return TaskMapper.toResponse(task);
  }

  async update(
    taskId: string,
    userId: string,
    dto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    if (
      dto.title === undefined &&
      dto.description === undefined &&
      dto.acceptanceCriteria === undefined &&
      dto.priority === undefined &&
      dto.dueAt === undefined
    ) {
      throw new BadRequestException('No changes provided');
    }

    if (
      dto.title === null ||
      (dto.title !== undefined && !dto.title.trim())
    ) {
      throw new BadRequestException('Task title is required');
    }

    const task = await this.tasksRepository.findOne({
      where: { id: taskId, deletedAt: IsNull() },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.workspacesService.findOneForUser(task.workspaceId, userId);

    const changes: Partial<Task> = {
      updatedAt: new Date(),
    };

    if (dto.title !== undefined) {
      changes.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      changes.description = dto.description;
    }
    if (dto.acceptanceCriteria !== undefined) {
      changes.acceptanceCriteria = dto.acceptanceCriteria;
    }
    if (dto.priority !== undefined) {
      changes.priority = dto.priority;
    }
    if (dto.dueAt !== undefined) {
      changes.dueAt = dto.dueAt === null ? null : new Date(dto.dueAt);
    }

    const result = await this.tasksRepository.update(
      { id: taskId, deletedAt: IsNull() },
      changes,
    );

    if (!result.affected) {
      throw new NotFoundException('Task not found');
    }

    const updatedTask = await this.tasksRepository.findOne({
      where: { id: taskId, deletedAt: IsNull() },
    });

    if (!updatedTask) {
      throw new NotFoundException('Task not found');
    }

    return TaskMapper.toResponse(updatedTask);
  }

  async transition(
    taskId: string,
    userId: string,
    dto: TransitionTaskDto,
  ): Promise<TaskResponseDto> {
    const existingTask = await this.tasksRepository.findOne({
      where: { id: taskId, deletedAt: IsNull() },
    });

    if (!existingTask) {
      throw new NotFoundException('Task not found');
    }

    await this.workspacesService.findOneForUser(
      existingTask.workspaceId,
      userId,
    );

    const settings =
      dto.toStatus === TaskStatus.IN_PROGRESS
        ? await this.workspacesService.getKanbanSettings(
            existingTask.workspaceId,
            userId,
          )
        : null;

    return this.dataSource.transaction(async (manager) => {
      const tasksRepository = manager.getRepository(Task);

      const workspaceTasks = await tasksRepository
        .createQueryBuilder('task')
        .where('task.workspaceId = :workspaceId', {
          workspaceId: existingTask.workspaceId,
        })
        .andWhere('task.deletedAt IS NULL')
        .orderBy('task.id', 'ASC')
        .setLock('pessimistic_write')
        .getMany();

      const task = workspaceTasks.find((item) => item.id === taskId);

      if (!task) {
        throw new NotFoundException('Task not found');
      }

      if (!this.isAllowedTransition(task.status, dto.toStatus)) {
        throw new BadRequestException(
          `Cannot move task from ${task.status} to ${dto.toStatus}`,
        );
      }

      if (
        task.status === TaskStatus.READY &&
        dto.toStatus === TaskStatus.IN_PROGRESS
      ) {
        const activeCount = await tasksRepository.count({
          where: {
            workspaceId: task.workspaceId,
            deletedAt: IsNull(),
            status: In([
              TaskStatus.IN_PROGRESS,
              TaskStatus.REVIEW,
            ]),
          },
        });

        if (activeCount >= settings!.activeWipLimit) {
          throw new ConflictException('Active WIP limit reached');
        }
      }

      const now = new Date();
      const previousStatus = task.status;

      task.status = dto.toStatus;
      task.updatedAt = now;

      if (dto.toStatus === TaskStatus.DONE) {
        task.completedAt = now;
      }

      if (dto.toStatus === TaskStatus.CANCELLED) {
        task.cancelledAt = now;
      }

      await tasksRepository.save(task);

      const history = manager.getRepository(TaskStatusHistory).create({
        id: randomUUID(),
        taskId,
        fromStatus: previousStatus,
        toStatus: dto.toStatus,
        changedById: userId,
        changedAt: now,
        note: dto.note ?? null,
      });

      await manager.getRepository(TaskStatusHistory).save(history);

      return TaskMapper.toResponse(task);
    });
  }

  async remove(taskId: string, userId: string): Promise<void> {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId, deletedAt: IsNull() },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.workspacesService.findOneForUser(
      task.workspaceId,
      userId,
    );

    const now = new Date();

    const result = await this.tasksRepository.update(
      { id: taskId, deletedAt: IsNull() },
      {
        deletedAt: now,
        updatedAt: now,
      },
    );

    if (!result.affected) {
      throw new NotFoundException('Task not found');
    }
  }

  async assign(
    taskId: string,
    actorId: string,
    dto: AssignTaskDto,
  ): Promise<TaskAssignmentResponseDto> {
    const existingTask = await this.tasksRepository.findOne({
      where: { id: taskId, deletedAt: IsNull() },
    });

    if (!existingTask) {
      throw new NotFoundException('Task not found');
    }

    await this.workspacesService.findOneForUser(
      existingTask.workspaceId,
      actorId,
    );

    const assignee = await this.usersService.findById(dto.userId);

    if (assignee.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Assignee must be active');
    }

    try {
      await this.workspacesService.findOneForUser(
        existingTask.workspaceId,
        dto.userId,
      );
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw new BadRequestException(
          'Assignee must belong to the workspace',
        );
      }
      throw error;
    }

    return this.dataSource.transaction(async (manager) => {
      const task = await manager.getRepository(Task).findOne({
        where: { id: taskId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });

      if (!task) {
        throw new NotFoundException('Task not found');
      }

      const assignmentsRepository =
        manager.getRepository(TaskAssignment);

      const existingAssignment = await assignmentsRepository.findOne({
        where: { taskId },
      });

      if (existingAssignment) {
        throw new ConflictException('Task already assigned');
      }

      const assignment = assignmentsRepository.create({
        id: randomUUID(),
        taskId,
        userId: dto.userId,
        assignedById: actorId,
        assignedAt: new Date(),
      });

      const savedAssignment =
        await assignmentsRepository.save(assignment);

      return TaskAssignmentMapper.toResponse(savedAssignment);
    });
  }

  private isAllowedTransition(
    from: TaskStatus,
    to: TaskStatus,
  ): boolean {
    if (from === TaskStatus.BACKLOG) {
      return to === TaskStatus.READY || to === TaskStatus.CANCELLED;
    }

    if (from === TaskStatus.READY) {
      return (
        to === TaskStatus.BACKLOG ||
        to === TaskStatus.IN_PROGRESS ||
        to === TaskStatus.CANCELLED
      );
    }

    if (from === TaskStatus.IN_PROGRESS) {
      return to === TaskStatus.REVIEW || to === TaskStatus.CANCELLED;
    }

    if (from === TaskStatus.REVIEW) {
      return (
        to === TaskStatus.IN_PROGRESS ||
        to === TaskStatus.DONE ||
        to === TaskStatus.CANCELLED
      );
    }

    return false;
  }

    async getAssignment(
      taskId: string,
      userId: string,
    ): Promise<TaskAssignmentResponseDto | null> {
      const task = await this.tasksRepository.findOne({
        where: { id: taskId, deletedAt: IsNull() },
      });

      if (!task) {
        throw new NotFoundException('Task not found');
      }

      await this.workspacesService.findOneForUser(
        task.workspaceId,
        userId,
      );

      const assignment = await this.dataSource
        .getRepository(TaskAssignment)
        .findOne({ where: { taskId } });

      return assignment
        ? TaskAssignmentMapper.toResponse(assignment)
        : null;
    }
      async unassign(taskId: string, userId: string): Promise<void> {
      const existingTask = await this.tasksRepository.findOne({
        where: { id: taskId, deletedAt: IsNull() },
      });

      if (!existingTask) {
        throw new NotFoundException('Task not found');
      }

      await this.workspacesService.findOneForUser(
        existingTask.workspaceId,
        userId,
      );

      await this.dataSource.transaction(async (manager) => {
        const task = await manager.getRepository(Task).findOne({
          where: { id: taskId, deletedAt: IsNull() },
          lock: { mode: 'pessimistic_write' },
        });

        if (!task) {
          throw new NotFoundException('Task not found');
        }

        const result = await manager
          .getRepository(TaskAssignment)
          .delete({ taskId });

        if (!result.affected) {
          throw new NotFoundException('Task assignment not found');
        }
      });
    }
      async addComment(
      taskId: string,
      userId: string,
      dto: CreateTaskCommentDto,
    ): Promise<TaskCommentResponseDto> {
      const content = dto.content.trim();

      if (!content) {
        throw new BadRequestException('Comment content is required');
      }

      const existingTask = await this.tasksRepository.findOne({
        where: { id: taskId, deletedAt: IsNull() },
      });

      if (!existingTask) {
        throw new NotFoundException('Task not found');
      }

      await this.workspacesService.findOneForUser(
        existingTask.workspaceId,
        userId,
      );

      return this.dataSource.transaction(async (manager) => {
        const task = await manager.getRepository(Task).findOne({
          where: { id: taskId, deletedAt: IsNull() },
          lock: { mode: 'pessimistic_write' },
        });

        if (!task) {
          throw new NotFoundException('Task not found');
        }

        const now = new Date();

        const comment = manager.getRepository(TaskComment).create({
          id: randomUUID(),
          taskId,
          authorId: userId,
          content,
          createdAt: now,
          updatedAt: now,
          editedAt: null,
          deletedAt: null,
        });

        const savedComment =
          await manager.getRepository(TaskComment).save(comment);

        return TaskCommentMapper.toResponse(savedComment);
      });
    }

      async updateComment(
      taskId: string,
      commentId: string,
      userId: string,
      dto: CreateTaskCommentDto,
    ): Promise<TaskCommentResponseDto> {
      const content = dto.content.trim();

      if (!content) {
        throw new BadRequestException('Comment content is required');
      }

      const existingTask = await this.tasksRepository.findOne({
        where: { id: taskId, deletedAt: IsNull() },
      });

      if (!existingTask) {
        throw new NotFoundException('Task not found');
      }

      await this.workspacesService.findOneForUser(
        existingTask.workspaceId,
        userId,
      );

      return this.dataSource.transaction(async (manager) => {
        const task = await manager.getRepository(Task).findOne({
          where: { id: taskId, deletedAt: IsNull() },
          lock: { mode: 'pessimistic_write' },
        });

        if (!task) {
          throw new NotFoundException('Task not found');
        }

        const commentsRepository = manager.getRepository(TaskComment);

        const comment = await commentsRepository.findOne({
          where: {
            id: commentId,
            taskId,
            deletedAt: IsNull(),
          },
          lock: { mode: 'pessimistic_write' },
        });

        if (!comment) {
          throw new NotFoundException('Comment not found');
        }

        if (comment.authorId !== userId) {
          throw new ForbiddenException(
            'Only the author can edit this comment',
          );
        }

        const now = new Date();

        comment.content = content;
        comment.updatedAt = now;
        comment.editedAt = now;

        const savedComment = await commentsRepository.save(comment);

        return TaskCommentMapper.toResponse(savedComment);
      });
    }
      async listComments(
      taskId: string,
      userId: string,
    ): Promise<TaskCommentResponseDto[]> {
      const task = await this.tasksRepository.findOne({
        where: { id: taskId, deletedAt: IsNull() },
      });

      if (!task) {
        throw new NotFoundException('Task not found');
      }

      await this.workspacesService.findOneForUser(
        task.workspaceId,
        userId,
      );

      const comments = await this.dataSource
        .getRepository(TaskComment)
        .find({
          where: {
            taskId,
            deletedAt: IsNull(),
          },
          order: {
            createdAt: 'ASC',
            id: 'ASC',
          },
        });

      return comments.map((comment) =>
        TaskCommentMapper.toResponse(comment),
      );
    }
      async removeComment(
      taskId: string,
      commentId: string,
      userId: string,
    ): Promise<void> {
      const existingTask = await this.tasksRepository.findOne({
        where: { id: taskId, deletedAt: IsNull() },
      });

      if (!existingTask) {
        throw new NotFoundException('Task not found');
      }

      await this.workspacesService.findOneForUser(
        existingTask.workspaceId,
        userId,
      );

      await this.dataSource.transaction(async (manager) => {
        const task = await manager.getRepository(Task).findOne({
          where: { id: taskId, deletedAt: IsNull() },
          lock: { mode: 'pessimistic_write' },
        });

        if (!task) {
          throw new NotFoundException('Task not found');
        }

        const commentsRepository = manager.getRepository(TaskComment);

        const comment = await commentsRepository.findOne({
          where: {
            id: commentId,
            taskId,
            deletedAt: IsNull(),
          },
          lock: { mode: 'pessimistic_write' },
        });

        if (!comment) {
          throw new NotFoundException('Comment not found');
        }

        if (comment.authorId !== userId) {
          throw new ForbiddenException(
            'Only the author can delete this comment',
          );
        }

        const now = new Date();

        comment.deletedAt = now;
        comment.updatedAt = now;

        await commentsRepository.save(comment);
      });
    }
}
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, In, IsNull, Repository } from 'typeorm';

import { TaskStatus, UserStatus } from '../../../database/enums/database.enums';
import { ActivitiesService } from '../../activities/services/activities.service';
import { UsersService } from '../../users/services/users.service';
import { WorkspacesService } from '../../workspaces/services/workspaces.service';
import { canTransitionTask, compareBoardTasks, defaultBoardColumns, taskColumn } from '../../workspaces/board-columns';
import { WorkspaceKanbanSetting } from '../../workspaces/entities/workspace-kanban-setting.entity';
import { AssignTaskDto } from '../dto/assign-task.dto';
import { CreateTaskDto } from '../dto/create-task.dto';
import { TaskAssignmentResponseDto } from '../dto/task-assignment-response.dto';
import { TaskBoardResponseDto } from '../dto/task-board-response.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { TransitionTaskDto } from '../dto/transition-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { TaskAssignment } from '../entities/task-assignment.entity';
import { TaskStatusHistory } from '../entities/task-status-history.entity';
import { taskDeadline, workspaceReportingTimeZone } from '../workspace-calendar';
import { Task } from '../entities/task.entity';
import { TaskAssignmentMapper } from '../mappers/task-assignment.mapper';
import { TaskMapper } from '../mappers/task.mapper';
import { CreateTaskCommentDto } from '../dto/create-task-comment.dto';
import { TaskCommentResponseDto } from '../dto/task-comment-response.dto';
import { TaskComment } from '../entities/task-comment.entity';
import { TaskCommentMapper } from '../mappers/task-comment.mapper';
import { CreateTaskDependencyDto } from '../dto/create-task-dependency.dto';
import { TaskDependencyResponseDto } from '../dto/task-dependency-response.dto';
import { TaskDependency } from '../entities/task-dependency.entity';
import { TaskDependencyMapper } from '../mappers/task-dependency.mapper';
import { BlockTaskDto } from '../dto/block-task.dto';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    private readonly workspacesService: WorkspacesService,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
    private readonly activitiesService: ActivitiesService,
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
      ...taskDeadline(dto.dueDate, dto.dueAt),
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      cancelledAt: null,
      deletedAt: null,
    });

    const savedTask = dto.boardColumnId
      ? await this.dataSource.transaction(async manager => {
          const settings = await manager.getRepository(WorkspaceKanbanSetting).findOne({
            where: { workspaceId }, lock: { mode: 'pessimistic_write' },
          });
          const columns = settings?.boardColumns ?? defaultBoardColumns();
          const column = columns.find(item => item.id === dto.boardColumnId);
          if (!column || !settings) throw new BadRequestException('This column is unavailable');
          const repository = manager.getRepository(Task);
          const existing = await repository.find({ where: { workspaceId, deletedAt: IsNull() } });
          if (column.limit && existing.filter(item => taskColumn(columns, item.status, item.boardColumnId).id === column.id).length >= column.limit) {
            throw new ConflictException('This column has reached its task limit');
          }
          if ([TaskStatus.IN_PROGRESS, TaskStatus.REVIEW].includes(column.status)
            && existing.filter(item => [TaskStatus.IN_PROGRESS, TaskStatus.REVIEW].includes(item.status)).length >= settings.activeWipLimit) {
            throw new ConflictException('Active WIP limit reached');
          }
          task.boardColumnId = column.id;
          task.position = existing
            .filter(item => taskColumn(columns, item.status, item.boardColumnId).id === column.id)
            .reduce((last, item) => Math.max(last, item.position), -1) + 1;
          task.status = column.status;
          if (column.status === TaskStatus.DONE) task.completedAt = now;
          if (column.status === TaskStatus.CANCELLED) task.cancelledAt = now;
          return repository.save(task);
        })
      : await this.tasksRepository.save(task);

    try {
      await this.activitiesService.create({
        workspaceId,
        actorUserId: userId,
        actionType: 'TASK_CREATED',
        resourceType: 'task',
        resourceId: savedTask.id,
        metadata: {
          title: savedTask.title,
          status: savedTask.status,
          priority: savedTask.priority,
        },
      });
    } catch (error) {
      this.logger.error(
        `Could not create TASK_CREATED activity for task ${savedTask.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

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

    const assignments = tasks.length
      ? await this.dataSource.getRepository(TaskAssignment).find({
          where: { taskId: In(tasks.map((task) => task.id)) },
          select: { taskId: true, userId: true },
        })
      : [];
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
      reportingTimeZone: workspaceReportingTimeZone,
      activeWipLimit: settings.activeWipLimit,
      activeCount,
      assigneesByTaskId: Object.fromEntries(
        assignments.map((assignment) => [assignment.taskId, assignment.userId]),
      ),
      ...(settings.boardColumns ? { boardColumns: settings.boardColumns } : {}),
      columns,
    };
  }

  async findById(taskId: string, userId: string): Promise<TaskResponseDto> {
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
      dto.dueAt === undefined &&
      dto.dueDate === undefined &&
      dto.position === undefined
    ) {
      throw new BadRequestException('No changes provided');
    }

    if (dto.title === null || (dto.title !== undefined && !dto.title.trim())) {
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

    if (dto.dueDate !== undefined || dto.dueAt !== undefined) {
      Object.assign(changes, taskDeadline(dto.dueDate, dto.dueAt));
    }

    if (dto.position !== undefined) {
      changes.position = dto.position;
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
    if (dto.placement && !dto.boardColumnId) throw new BadRequestException('Choose a destination column for card placement');
    if ((dto.placement === 'before' || dto.placement === 'after') !== !!dto.anchorTaskId) {
      throw new BadRequestException('Choose a card to place the task next to');
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

    const settings =
      !dto.boardColumnId && dto.toStatus === TaskStatus.IN_PROGRESS
        ? await this.workspacesService.getKanbanSettings(
            existingTask.workspaceId,
            userId,
          )
        : null;

    const result = await this.dataSource.transaction(async (manager) => {
      const tasksRepository = manager.getRepository(Task);
      const columnSettings = dto.boardColumnId ? await manager.getRepository(WorkspaceKanbanSetting).findOne({
        where: { workspaceId: existingTask.workspaceId }, lock: { mode: 'pessimistic_write' },
      }) : null;

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

      const defaults = defaultBoardColumns();
      const configured = columnSettings?.boardColumns ?? defaults;
      const layout = [...configured, ...defaults.filter(column =>
        !configured.some(item => item.status === column.status)
        && workspaceTasks.some(item => item.status === column.status),
      )];
      const column = dto.boardColumnId ? layout.find(item => item.id === dto.boardColumnId && item.status === dto.toStatus) : undefined;
      if (dto.boardColumnId && !column) throw new BadRequestException('This column is unavailable');
      if (column && task.status === dto.toStatus) {
        if (dto.placement) await this.placeTask(tasksRepository, workspaceTasks, layout, column.id, task, dto);
        task.boardColumnId = column.id;
        task.updatedAt = new Date();
        await tasksRepository.save(task);
        return { response: TaskMapper.toResponse(task), previousStatus: task.status };
      }

      if (!column && !canTransitionTask(task.status, dto.toStatus)) {
        throw new BadRequestException(
          `Cannot move task from ${task.status} to ${dto.toStatus}`,
        );
      }

      if (
        !column && task.status === TaskStatus.READY &&
        dto.toStatus === TaskStatus.IN_PROGRESS
      ) {
        const activeCount = await tasksRepository.count({
          where: {
            workspaceId: task.workspaceId,
            deletedAt: IsNull(),
            status: In([TaskStatus.IN_PROGRESS, TaskStatus.REVIEW]),
          },
        });

        if (activeCount >= settings!.activeWipLimit) {
          throw new ConflictException('Active WIP limit reached');
        }
      }

      const now = new Date();
      const previousStatus = task.status;

      if (column && dto.placement) await this.placeTask(tasksRepository, workspaceTasks, layout, column.id, task, dto);
      task.status = dto.toStatus;
      if (column || task.boardColumnId) task.boardColumnId = column?.id ?? null;
      task.updatedAt = now;

      if (dto.toStatus === TaskStatus.DONE) {
        task.completedAt = now;
      } else if (previousStatus === TaskStatus.DONE) {
        task.completedAt = null;
      }

      if (dto.toStatus === TaskStatus.CANCELLED) {
        task.cancelledAt = now;
      } else if (previousStatus === TaskStatus.CANCELLED) {
        task.cancelledAt = null;
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

      return {
        response: TaskMapper.toResponse(task),
        previousStatus,
      };
    });

    if (result.previousStatus === result.response.status) return result.response;
    try {
      await this.activitiesService.create({
        workspaceId: existingTask.workspaceId,
        actorUserId: userId,
        actionType: 'TASK_STATUS_CHANGED',
        resourceType: 'task',
        resourceId: taskId,
        metadata: {
          title: result.response.title,
          fromStatus: result.previousStatus,
          toStatus: result.response.status,
          note: dto.note ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Could not create TASK_STATUS_CHANGED activity for task ${taskId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return result.response;
  }

  async remove(taskId: string, userId: string): Promise<void> {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId, deletedAt: IsNull() },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.workspacesService.findOneForUser(task.workspaceId, userId);

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
        throw new BadRequestException('Assignee must belong to the workspace');
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

      const assignmentsRepository = manager.getRepository(TaskAssignment);

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

      const savedAssignment = await assignmentsRepository.save(assignment);

      return TaskAssignmentMapper.toResponse(savedAssignment);
    });
  }

  async addDependency(
    taskId: string,
    userId: string,
    dto: CreateTaskDependencyDto,
  ): Promise<TaskDependencyResponseDto> {
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
      const workspaceTasks = await manager
        .getRepository(Task)
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

      if (taskId === dto.dependsOnTaskId) {
        throw new BadRequestException('A task cannot depend on itself');
      }

      const prerequisite = workspaceTasks.find(
        (item) => item.id === dto.dependsOnTaskId,
      );

      if (!prerequisite) {
        throw new NotFoundException(
          'Dependency task not found in this workspace',
        );
      }

      const dependenciesRepository = manager.getRepository(TaskDependency);

      const existingDependencies = await dependenciesRepository.find({
        where: {
          taskId: In(workspaceTasks.map((item) => item.id)),
        },
      });

      const duplicate = existingDependencies.some(
        (item) =>
          item.taskId === taskId &&
          item.dependsOnTaskId === dto.dependsOnTaskId,
      );

      if (duplicate) {
        throw new ConflictException('Task dependency already exists');
      }

      const visited = new Set<string>();
      const toCheck = [dto.dependsOnTaskId];

      while (toCheck.length > 0) {
        const current = toCheck.pop()!;

        if (current === taskId) {
          throw new BadRequestException('Dependency would create a cycle');
        }

        if (visited.has(current)) {
          continue;
        }

        visited.add(current);

        for (const dependency of existingDependencies) {
          if (dependency.taskId === current) {
            toCheck.push(dependency.dependsOnTaskId);
          }
        }
      }

      const dependency = dependenciesRepository.create({
        id: randomUUID(),
        taskId,
        dependsOnTaskId: dto.dependsOnTaskId,
        createdById: userId,
        createdAt: new Date(),
      });

      const savedDependency = await dependenciesRepository.save(dependency);

      return TaskDependencyMapper.toResponse(savedDependency);
    });
  }

  async listDependencies(
    taskId: string,
    userId: string,
  ): Promise<TaskDependencyResponseDto[]> {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId, deletedAt: IsNull() },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.workspacesService.findOneForUser(task.workspaceId, userId);

    const dependencies = await this.dataSource
      .getRepository(TaskDependency)
      .find({
        where: { taskId },
        order: {
          createdAt: 'ASC',
          id: 'ASC',
        },
      });

    return dependencies.map((dependency) =>
      TaskDependencyMapper.toResponse(dependency),
    );
  }

  async removeDependency(
    taskId: string,
    userId: string,
    dependencyId: string,
  ): Promise<void> {
    await this.findById(taskId, userId);

    const result = await this.dataSource
      .getRepository(TaskDependency)
      .delete({ id: dependencyId, taskId });

    if (!result.affected) {
      throw new NotFoundException('Task dependency not found');
    }
  }

  async block(
    taskId: string,
    userId: string,
    dto: BlockTaskDto,
  ): Promise<TaskResponseDto> {
    const reason = dto.reason.trim();

    if (!reason) {
      throw new BadRequestException('Block reason is required');
    }

    await this.findById(taskId, userId);

    const now = new Date();

    const result = await this.tasksRepository.update(
      { id: taskId, deletedAt: IsNull(), isBlocked: false },
      {
        isBlocked: true,
        blockedReason: reason,
        blockedAt: now,
        updatedAt: now,
      },
    );

    if (!result.affected) {
      await this.findById(taskId, userId);
      throw new ConflictException('Task is already blocked');
    }

    return this.findById(taskId, userId);
  }

  async unblock(taskId: string, userId: string): Promise<TaskResponseDto> {
    await this.findById(taskId, userId);

    const result = await this.tasksRepository.update(
      { id: taskId, deletedAt: IsNull(), isBlocked: true },
      {
        isBlocked: false,
        blockedReason: null,
        blockedAt: null,
        updatedAt: new Date(),
      },
    );

    if (!result.affected) {
      await this.findById(taskId, userId);
      throw new ConflictException('Task is not blocked');
    }

    return this.findById(taskId, userId);
  }

  private async placeTask(
    repository: Repository<Task>,
    tasks: Task[],
    layout: ReturnType<typeof defaultBoardColumns>,
    columnId: string,
    moved: Task,
    dto: TransitionTaskDto,
  ) {
    const ordered = tasks
      .filter(task => task.id !== moved.id && taskColumn(layout, task.status, task.boardColumnId).id === columnId)
      .sort(compareBoardTasks);
    const anchor = ordered.findIndex(task => task.id === dto.anchorTaskId);
    if (dto.anchorTaskId && anchor < 0) {
      throw new ConflictException('The reference card moved. Refresh the board and try again.');
    }
    const index = dto.placement === 'end' ? ordered.length : anchor + Number(dto.placement === 'after');
    ordered.splice(index, 0, moved);
    for (const [position, task] of ordered.entries()) {
      if (task === moved) moved.position = position;
      else if (task.position !== position) await repository.update({ id: task.id }, { position });
    }
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

    await this.workspacesService.findOneForUser(task.workspaceId, userId);

    const assignment = await this.dataSource
      .getRepository(TaskAssignment)
      .findOne({ where: { taskId } });

    return assignment ? TaskAssignmentMapper.toResponse(assignment) : null;
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

      const savedComment = await manager
        .getRepository(TaskComment)
        .save(comment);

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
        throw new ForbiddenException('Only the author can edit this comment');
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

    await this.workspacesService.findOneForUser(task.workspaceId, userId);

    const comments = await this.dataSource.getRepository(TaskComment).find({
      where: {
        taskId,
        deletedAt: IsNull(),
      },
      order: {
        createdAt: 'ASC',
        id: 'ASC',
      },
    });

    return comments.map((comment) => TaskCommentMapper.toResponse(comment));
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
        throw new ForbiddenException('Only the author can delete this comment');
      }

      const now = new Date();

      comment.deletedAt = now;
      comment.updatedAt = now;

      await commentsRepository.save(comment);
    });
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, IsNull } from 'typeorm';

import { InvitationStatus } from '../../../database/enums/database.enums';
import { ActivitiesService } from '../../activities/services/activities.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { UsersService } from '../../users/services/users.service';
import { Task } from '../../tasks/entities/task.entity';
import { TaskStatusHistory } from '../../tasks/entities/task-status-history.entity';
import { Activity } from '../../activities/entities/activity.entity';
import { canTransitionTask, compareBoardTasks, defaultBoardColumns, isActiveTaskStatus, taskColumn } from '../board-columns';
import { CreateWorkspaceInvitationDto } from '../dto/create-workspace-invitation.dto';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { SaveBacklogViewDto } from '../dto/save-backlog-view.dto';
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import { WorkspaceMemberResponseDto } from '../dto/workspace-member-response.dto';
import { WorkspaceInvitationResponseDto } from '../dto/workspace-invitation-response.dto';
import { WorkspaceResponseDto } from '../dto/workspace-response.dto';
import { WorkspaceInvitation } from '../entities/workspace-invitation.entity';
import { WorkspaceKanbanSetting } from '../entities/workspace-kanban-setting.entity';
import { WorkspaceMembership } from '../entities/workspace-membership.entity';
import { Workspace } from '../entities/workspace.entity';
import { WorkspaceInvitationMapper } from '../mappers/workspace-invitation.mapper';
import { WorkspaceMapper } from '../mappers/workspace.mapper';

import { WorkspaceKanbanSettingsResponseDto } from '../dto/workspace-kanban-settings-response.dto';
import { WorkspaceKanbanSettingsMapper } from '../mappers/workspace-kanban-settings.mapper';
import { UpdateWorkspaceKanbanSettingsDto } from '../dto/update-workspace-kanban-settings.dto';
@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async create(
    ownerId: string,
    dto: CreateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const now = new Date();

      const workspace = manager.create(Workspace, {
        id: randomUUID(),
        ownerId,
        name: dto.name,
        description: dto.description ?? null,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        deletedAt: null,
      });

      const savedWorkspace = await manager.save(workspace);

      const membership = manager.create(WorkspaceMembership, {
        id: randomUUID(),
        workspaceId: savedWorkspace.id,
        userId: ownerId,
        joinedAt: now,
      });

      await manager.save(membership);

      const kanbanSettings = manager.create(WorkspaceKanbanSetting, {
        id: randomUUID(),
        workspaceId: savedWorkspace.id,
        activeWipLimit: 3,
        definitionOfReady: null,
        definitionOfDone: null,
        createdAt: now,
        updatedAt: now,
      });

      await manager.save(kanbanSettings);

      return WorkspaceMapper.toResponse(savedWorkspace);
    });
  }

  async findAllForUser(userId: string): Promise<WorkspaceResponseDto[]> {
    const workspaces = await this.dataSource
      .getRepository(Workspace)
      .createQueryBuilder('workspace')
      .innerJoin(
        WorkspaceMembership,
        'membership',
        'membership.workspaceId = workspace.id',
      )
      .where('membership.userId = :userId', { userId })
      .andWhere('workspace.deletedAt IS NULL')
      .orderBy('workspace.createdAt', 'ASC')
      .getMany();

    return workspaces.map((workspace) => WorkspaceMapper.toResponse(workspace));
  }

  async findOneForUser(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceResponseDto> {
    const workspace = await this.dataSource.getRepository(Workspace).findOne({
      where: {
        id: workspaceId,
        deletedAt: IsNull(),
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const membership = await this.dataSource
      .getRepository(WorkspaceMembership)
      .findOne({
        where: {
          workspaceId,
          userId,
        },
      });

    if (!membership) {
      throw new ForbiddenException();
    }

    return WorkspaceMapper.toResponse(workspace);
  }

  async getBacklogViews(workspaceId: string, userId: string): Promise<SaveBacklogViewDto[]> {
    await this.findOneForUser(workspaceId, userId);
    const membership = await this.dataSource.getRepository(WorkspaceMembership).findOneBy({ workspaceId, userId });
    if (!membership) throw new ForbiddenException();
    return membership.backlogViews ?? [];
  }

  async saveBacklogView(workspaceId: string, userId: string, dto: SaveBacklogViewDto): Promise<SaveBacklogViewDto[]> {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Enter a view name');
    await this.findOneForUser(workspaceId, userId);
    return this.dataSource.transaction(async manager => {
      const repository = manager.getRepository(WorkspaceMembership);
      const membership = await repository.findOne({
        where: { workspaceId, userId }, lock: { mode: 'pessimistic_write' },
      });
      if (!membership) throw new ForbiddenException();
      const views = (membership.backlogViews ?? []).filter(view => view.name !== name);
      if (views.length >= 30) throw new ConflictException('You can save up to 30 backlog views');
      views.push({ name, view: dto.view });
      await repository.update(membership.id, { backlogViews: views });
      return views;
    });
  }

  async assertOwner(workspaceId: string, userId: string): Promise<void> {
    const workspace = await this.dataSource.getRepository(Workspace).findOne({
      where: {
        id: workspaceId,
        deletedAt: IsNull(),
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.ownerId !== userId) {
      throw new ForbiddenException();
    }
  }

  async update(
    workspaceId: string,
    userId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException('No changes provided');
    }

    const repository = this.dataSource.getRepository(Workspace);

    const workspace = await repository.findOne({
      where: {
        id: workspaceId,
        deletedAt: IsNull(),
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.ownerId !== userId) {
      throw new ForbiddenException();
    }

    if (dto.name !== undefined) {
      workspace.name = dto.name;
    }

    if (dto.description !== undefined) {
      workspace.description = dto.description;
    }

    workspace.updatedAt = new Date();

    const savedWorkspace = await repository.save(workspace);

    return WorkspaceMapper.toResponse(savedWorkspace);
  }

  async archive(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceResponseDto> {
    const repository = this.dataSource.getRepository(Workspace);

    const workspace = await repository.findOne({
      where: {
        id: workspaceId,
        deletedAt: IsNull(),
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.ownerId !== userId) {
      throw new ForbiddenException();
    }

    workspace.archivedAt = new Date();
    workspace.updatedAt = new Date();

    const savedWorkspace = await repository.save(workspace);

    return WorkspaceMapper.toResponse(savedWorkspace);
  }

  async unarchive(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceResponseDto> {
    const repository = this.dataSource.getRepository(Workspace);

    const workspace = await repository.findOne({
      where: {
        id: workspaceId,
        deletedAt: IsNull(),
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.ownerId !== userId) {
      throw new ForbiddenException();
    }

    workspace.archivedAt = null;
    workspace.updatedAt = new Date();

    const savedWorkspace = await repository.save(workspace);

    return WorkspaceMapper.toResponse(savedWorkspace);
  }

  async softDelete(workspaceId: string, userId: string): Promise<void> {
    const repository = this.dataSource.getRepository(Workspace);

    const workspace = await repository.findOne({
      where: {
        id: workspaceId,
        deletedAt: IsNull(),
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.ownerId !== userId) {
      throw new ForbiddenException();
    }

    workspace.deletedAt = new Date();
    workspace.updatedAt = new Date();

    await repository.save(workspace);
  }

  async findMembers(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMemberResponseDto[]> {
    const workspace = await this.findOneForUser(workspaceId, userId);

    const memberships = await this.dataSource
      .getRepository(WorkspaceMembership)
      .find({
        where: {
          workspaceId,
        },
        relations: {
          user: true,
        },
        order: {
          joinedAt: 'ASC',
        },
      });

    return memberships.map((membership) => ({
      membershipId: membership.id,
      userId: membership.userId,
      username: membership.user.username,
      avatarUrl: membership.user.avatarUrl,
      joinedAt: membership.joinedAt,
      isOwner: membership.userId === workspace.ownerId,
    }));
  }

  async removeMember(
    workspaceId: string,
    currentUserId: string,
    memberUserId: string,
  ): Promise<void> {
    const workspaceRepository = this.dataSource.getRepository(Workspace);

    const workspace = await workspaceRepository.findOne({
      where: {
        id: workspaceId,
        deletedAt: IsNull(),
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.ownerId !== currentUserId) {
      throw new ForbiddenException();
    }

    if (workspace.ownerId === memberUserId) {
      throw new BadRequestException('Workspace owner cannot be removed');
    }

    const membershipRepository =
      this.dataSource.getRepository(WorkspaceMembership);

    const membership = await membershipRepository.findOne({
      where: {
        workspaceId,
        userId: memberUserId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Workspace member not found');
    }

    const membershipId = membership.id;

    await membershipRepository.remove(membership);

    try {
      await this.activitiesService.create({
        workspaceId,
        actorUserId: currentUserId,
        actionType: 'MEMBER_REMOVED',
        resourceType: 'workspace_membership',
        resourceId: membershipId,
        metadata: {
          memberUserId,
        },
      });
    } catch (error) {
      this.logger.error(
        `Could not create MEMBER_REMOVED activity for user ${memberUserId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async listPendingInvitations(workspaceId: string, userId: string): Promise<WorkspaceInvitationResponseDto[]> {
    await this.assertOwner(workspaceId, userId);
    const invitations = await this.dataSource.getRepository(WorkspaceInvitation).find({
      where: { workspaceId, status: InvitationStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
    return invitations.map(invitation => WorkspaceInvitationMapper.toResponse(invitation));
  }

  async createInvitation(
    workspaceId: string,
    currentUserId: string,
    dto: CreateWorkspaceInvitationDto,
  ): Promise<WorkspaceInvitationResponseDto> {
    const workspaceRepository = this.dataSource.getRepository(Workspace);

    const workspace = await workspaceRepository.findOne({
      where: {
        id: workspaceId,
        deletedAt: IsNull(),
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.ownerId !== currentUserId) {
      throw new ForbiddenException();
    }

    if (Boolean(dto.invitedUserId) === Boolean(dto.invitedEmail)) {
      throw new BadRequestException('Provide one user ID or email address');
    }

    const email = dto.invitedEmail?.trim().toLowerCase();
    const invitedUserId = dto.invitedUserId ?? (email ? (await this.usersService.findByEmail(email))?.id : undefined);
    if (!invitedUserId) {
      throw new NotFoundException('No DevUP account was found for that email address');
    }

    if (invitedUserId === currentUserId) {
      throw new BadRequestException('Workspace owner cannot invite themselves');
    }

    if (dto.invitedUserId) await this.usersService.findById(invitedUserId);


    const membershipRepository =
      this.dataSource.getRepository(WorkspaceMembership);

    const existingMembership = await membershipRepository.findOne({
      where: {
        workspaceId,
        userId: invitedUserId,
      },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a workspace member');
    }

    const invitationRepository =
      this.dataSource.getRepository(WorkspaceInvitation);

    const existingInvitation = await invitationRepository.findOne({
      where: {
        workspaceId,
        invitedUserId: invitedUserId,
        status: InvitationStatus.PENDING,
      },
    });

    if (existingInvitation) {
      throw new ConflictException('Pending invitation already exists');
    }

    const invitation = invitationRepository.create({
      id: randomUUID(),
      workspaceId,
      invitedById: currentUserId,
      invitedUserId: invitedUserId,
      invitedEmail: email ?? null,
      status: InvitationStatus.PENDING,
      tokenHash: null,
      expiresAt: null,
      respondedAt: null,
      createdAt: new Date(),
    });

    const savedInvitation = await invitationRepository.save(invitation);

    try {
      await this.notificationsService.createForUser({
        userId: invitedUserId,
        workspaceId,
        type: 'WORKSPACE_INVITATION',
        message: `You were invited to ${workspace.name}`,
        relatedResourceType: 'workspace_invitation',
        relatedResourceId: savedInvitation.id,
        payload: {
          invitedById: currentUserId,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to create workspace invitation notification for user ${invitedUserId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return WorkspaceInvitationMapper.toResponse(savedInvitation);
  }

  async acceptInvitation(
    workspaceId: string,
    invitationId: string,
    currentUserId: string,
  ): Promise<WorkspaceInvitationResponseDto> {
    const result = await this.dataSource.transaction(async (manager) => {
      const workspaceRepository = manager.getRepository(Workspace);

      const invitationRepository = manager.getRepository(WorkspaceInvitation);

      const membershipRepository = manager.getRepository(WorkspaceMembership);

      const workspace = await workspaceRepository.findOne({
        where: {
          id: workspaceId,
          deletedAt: IsNull(),
        },
      });

      if (!workspace) {
        throw new NotFoundException('Workspace not found');
      }

      const invitation = await invitationRepository.findOne({
        where: {
          id: invitationId,
          workspaceId,
        },
      });

      if (!invitation) {
        throw new NotFoundException('Invitation not found');
      }

      if (invitation.invitedUserId !== currentUserId) {
        throw new ForbiddenException();
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new ConflictException('Invitation is no longer pending');
      }

      const existingMembership = await membershipRepository.findOne({
        where: {
          workspaceId,
          userId: currentUserId,
        },
      });

      if (existingMembership) {
        throw new ConflictException('User is already a workspace member');
      }

      const now = new Date();

      const membership = membershipRepository.create({
        id: randomUUID(),
        workspaceId,
        userId: currentUserId,
        joinedAt: now,
      });

      await membershipRepository.save(membership);

      invitation.status = InvitationStatus.ACCEPTED;
      invitation.respondedAt = now;

      const savedInvitation = await invitationRepository.save(invitation);

      return {
        response: WorkspaceInvitationMapper.toResponse(savedInvitation),
        invitedById: invitation.invitedById,
        workspaceName: workspace.name,
        membershipId: membership.id,
      };
    });

    if (result.invitedById) {
      try {
        await this.notificationsService.createForUser({
          userId: result.invitedById,
          workspaceId,
          type: 'WORKSPACE_INVITATION_ACCEPTED',
          message: `Your invitation to ${result.workspaceName} was accepted`,
          relatedResourceType: 'workspace_invitation',
          relatedResourceId: invitationId,
          payload: {
            acceptedById: currentUserId,
          },
        });
      } catch (error) {
        this.logger.error(
          `Failed to create invitation accepted notification for user ${result.invitedById}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    try {
      await this.activitiesService.create({
        workspaceId,
        actorUserId: currentUserId,
        actionType: 'MEMBER_JOINED',
        resourceType: 'workspace_membership',
        resourceId: result.membershipId,
        metadata: {
          memberUserId: currentUserId,
          invitationId,
        },
      });
    } catch (error) {
      this.logger.error(
        `Could not create MEMBER_JOINED activity for user ${currentUserId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return result.response;
  }

  async rejectInvitation(
    workspaceId: string,
    invitationId: string,
    currentUserId: string,
  ): Promise<WorkspaceInvitationResponseDto> {
    const workspaceRepository = this.dataSource.getRepository(Workspace);

    const workspace = await workspaceRepository.findOne({
      where: {
        id: workspaceId,
        deletedAt: IsNull(),
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const invitationRepository =
      this.dataSource.getRepository(WorkspaceInvitation);

    const invitation = await invitationRepository.findOne({
      where: {
        id: invitationId,
        workspaceId,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.invitedUserId !== currentUserId) {
      throw new ForbiddenException();
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictException('Invitation is no longer pending');
    }

    invitation.status = InvitationStatus.REJECTED;
    invitation.respondedAt = new Date();

    const savedInvitation = await invitationRepository.save(invitation);

    return WorkspaceInvitationMapper.toResponse(savedInvitation);
  }

  async cancelInvitation(
    workspaceId: string,
    invitationId: string,
    currentUserId: string,
  ): Promise<WorkspaceInvitationResponseDto> {
    const workspaceRepository = this.dataSource.getRepository(Workspace);

    const workspace = await workspaceRepository.findOne({
      where: {
        id: workspaceId,
        deletedAt: IsNull(),
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.ownerId !== currentUserId) {
      throw new ForbiddenException();
    }

    const invitationRepository =
      this.dataSource.getRepository(WorkspaceInvitation);

    const invitation = await invitationRepository.findOne({
      where: {
        id: invitationId,
        workspaceId,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictException('Invitation is no longer pending');
    }

    invitation.status = InvitationStatus.CANCELLED;
    invitation.respondedAt = new Date();

    const savedInvitation = await invitationRepository.save(invitation);

    return WorkspaceInvitationMapper.toResponse(savedInvitation);
  }

  async getKanbanSettings(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceKanbanSettingsResponseDto> {
    await this.findOneForUser(workspaceId, userId);

    const settingsRepository = this.dataSource.getRepository(
      WorkspaceKanbanSetting,
    );

    const settings = await settingsRepository.findOne({
      where: {
        workspaceId,
      },
    });

    if (!settings) {
      throw new NotFoundException('Kanban settings not found');
    }

    return WorkspaceKanbanSettingsMapper.toResponse(settings);
  }

  async updateKanbanSettings(
    workspaceId: string,
    userId: string,
    dto: UpdateWorkspaceKanbanSettingsDto,
  ): Promise<WorkspaceKanbanSettingsResponseDto> {
    if (dto.moveColumnTasks && !dto.boardColumns) {
      throw new BadRequestException('Provide the board layout when moving a deleted column’s tasks');
    }
    if (
      dto.activeWipLimit === undefined &&
      dto.definitionOfReady === undefined &&
      dto.definitionOfDone === undefined &&
      dto.boardColumns === undefined
    ) {
      throw new BadRequestException('No changes provided');
    }

    const workspaceRepository = this.dataSource.getRepository(Workspace);

    const workspace = await workspaceRepository.findOne({
      where: {
        id: workspaceId,
        deletedAt: IsNull(),
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.ownerId !== userId) {
      throw new ForbiddenException();
    }

    if (dto.boardColumns) {
      const columns = dto.boardColumns.map(column => ({ ...column, label: column.label.trim() }));
      if (columns.some(column => !column.label) ||
        new Set(columns.map(column => column.id)).size !== columns.length ||
        new Set(columns.map(column => column.label.toLowerCase())).size !== columns.length) {
        throw new BadRequestException('Column names and IDs must be unique');
      }
      return this.dataSource.transaction(async manager => {
        const repository = manager.getRepository(WorkspaceKanbanSetting);
        const settings = await repository.findOne({ where: { workspaceId }, lock: { mode: 'pessimistic_write' } });
        if (!settings) throw new NotFoundException('Kanban settings not found');
        const previous = settings.boardColumns ?? defaultBoardColumns();
        if (columns.some(column => previous.some(old => old.id === column.id && old.status !== column.status))) {
          throw new BadRequestException('An existing column cannot change its workflow status');
        }
        const tasksRepository = manager.getRepository(Task);
        const tasks = dto.moveColumnTasks
          ? await tasksRepository.createQueryBuilder('task')
            .where('task.workspaceId = :workspaceId', { workspaceId })
            .andWhere('task.deletedAt IS NULL')
            .orderBy('task.id', 'ASC')
            .setLock('pessimistic_write').getMany()
          : await tasksRepository.find({ where: { workspaceId, deletedAt: IsNull() } });
        const move = dto.moveColumnTasks;
        if (move) {
          const source = previous.find(column => column.id === move.fromColumnId);
          const destination = columns.find(column => column.id === move.toColumnId);
          if (!source || !destination || columns.some(column => column.id === source.id)
            || !previous.some(column => column.id === destination.id)) {
            throw new BadRequestException('Choose a remaining destination column');
          }
          const remaining = previous.filter(column => column.id !== source.id);
          if (remaining.length !== columns.length || remaining.some((column, index) =>
            column.id !== columns[index].id || column.label !== columns[index].label
            || (column.limit ?? null) !== (columns[index].limit ?? null))) {
            throw new ConflictException('The board layout changed. Refresh the board and try again.');
          }
          if (source.status !== destination.status && !canTransitionTask(source.status, destination.status)) {
            throw new BadRequestException('The destination workflow status is not allowed');
          }
          const moving = tasks.filter(task => taskColumn(previous, task.status, task.boardColumnId).id === source.id).sort(compareBoardTasks);
          const staying = tasks.filter(task => taskColumn(previous, task.status, task.boardColumnId).id === destination.id).sort(compareBoardTasks);
          const activeCount = tasks.filter(task => isActiveTaskStatus(task.status)).length;
          const limit = dto.activeWipLimit ?? settings.activeWipLimit;
          if (!isActiveTaskStatus(source.status) && isActiveTaskStatus(destination.status) && activeCount + moving.length > limit) {
            throw new ConflictException('Active WIP limit reached');
          }
          const now = new Date();
          for (const [position, task] of staying.entries()) {
            if (task.position !== position) await tasksRepository.update({ id: task.id }, { position });
          }
          for (const [index, task] of moving.entries()) {
            const fromStatus = task.status;
            task.status = destination.status;
            task.boardColumnId = destination.id;
            task.position = staying.length + index;
            task.updatedAt = now;
            if (fromStatus !== task.status) {
              if (task.status === 'DONE') task.completedAt = now;
              if (task.status === 'CANCELLED') task.cancelledAt = now;
              await manager.insert(TaskStatusHistory, {
                id: randomUUID(), taskId: task.id, fromStatus, toStatus: task.status,
                changedById: userId, changedAt: now, note: null,
              });
              await manager.insert(Activity, {
                id: randomUUID(), workspaceId, actorUserId: userId, actionType: 'TASK_STATUS_CHANGED',
                resourceType: 'task', resourceId: task.id, createdAt: now,
                metadata: { title: task.title, fromStatus, toStatus: task.status },
              });
            }
            await tasksRepository.save(task);
          }
        }
        const counts = new Map<string, number>();
        for (const task of tasks) {
          const id = taskColumn(previous, task.status, task.boardColumnId).id;
          if (previous.some(column => column.id === id) && !columns.some(column => column.id === id)) {
            throw new ConflictException('Move the tasks out of the column before deleting it');
          }
          const next = taskColumn(columns, task.status, task.boardColumnId).id;
          counts.set(next, (counts.get(next) ?? 0) + 1);
        }
        if (columns.some(column => column.limit && (counts.get(column.id) ?? 0) > column.limit)) {
          throw new ConflictException('A column limit cannot be lower than its current task count');
        }
        settings.boardColumns = columns;
        if (dto.activeWipLimit !== undefined) settings.activeWipLimit = dto.activeWipLimit;
        if (dto.definitionOfReady !== undefined) settings.definitionOfReady = dto.definitionOfReady;
        if (dto.definitionOfDone !== undefined) settings.definitionOfDone = dto.definitionOfDone;
        settings.updatedAt = new Date();
        return WorkspaceKanbanSettingsMapper.toResponse(await repository.save(settings));
      });
    }

    const settingsRepository = this.dataSource.getRepository(
      WorkspaceKanbanSetting,
    );

    const settings = await settingsRepository.findOne({
      where: {
        workspaceId,
      },
    });

    if (!settings) {
      throw new NotFoundException('Kanban settings not found');
    }

    if (dto.activeWipLimit !== undefined) {
      settings.activeWipLimit = dto.activeWipLimit;
    }

    if (dto.definitionOfReady !== undefined) {
      settings.definitionOfReady = dto.definitionOfReady;
    }

    if (dto.definitionOfDone !== undefined) {
      settings.definitionOfDone = dto.definitionOfDone;
    }

    settings.updatedAt = new Date();

    const savedSettings = await settingsRepository.save(settings);

    return WorkspaceKanbanSettingsMapper.toResponse(savedSettings);
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DataSource, IsNull, type EntityManager } from 'typeorm';

import { InvitationStatus } from '../../../database/enums/database.enums';
import { ActivitiesService } from '../../activities/services/activities.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { UsersService } from '../../users/services/users.service';
import { Task } from '../../tasks/entities/task.entity';
import { TaskAssignment } from '../../tasks/entities/task-assignment.entity';
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
import { assertWorkspaceWritable, validateWorkspaceTimeZone } from '../workspace-policy';

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

  private readonly membershipRemovedListeners = new Set<(workspaceId: string, userId: string) => void>();

  onMembershipRemoved(listener: (workspaceId: string, userId: string) => void) {
    this.membershipRemovedListeners.add(listener);
    return () => this.membershipRemovedListeners.delete(listener);
  }

  private async lockWorkspace(manager: EntityManager, workspaceId: string) {
    const workspace = await manager.getRepository(Workspace).findOne({
      where: { id: workspaceId, deletedAt: IsNull() },
      lock: { mode: 'pessimistic_write' },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  async lockAssignmentMemberships(manager: EntityManager, workspaceId: string, actorId: string, assigneeId: string) {
    assertWorkspaceWritable(await this.lockWorkspace(manager, workspaceId));
    const memberships = manager.getRepository(WorkspaceMembership);
    if (!await memberships.findOneBy({ workspaceId, userId: actorId })) throw new ForbiddenException();
    if (assigneeId !== actorId && !await memberships.findOneBy({ workspaceId, userId: assigneeId })) {
      throw new BadRequestException('Assignee must belong to the workspace');
    }
  }

  async leaveWorkspace(workspaceId: string, userId: string): Promise<void> {
    await this.removeMember(workspaceId, userId, userId, true);
  }

  async transferOwnership(workspaceId: string, actorId: string, targetId: string): Promise<void> {
    await this.dataSource.transaction(async manager => {
      const workspace = await this.lockWorkspace(manager, workspaceId);
      if (workspace.ownerId !== actorId) throw new ForbiddenException();
      assertWorkspaceWritable(workspace);
      if (targetId === actorId) throw new BadRequestException('Choose another workspace member');
      const target = await manager.getRepository(WorkspaceMembership).findOneBy({ workspaceId, userId: targetId });
      if (!target) throw new NotFoundException('Workspace member not found');
      await manager.getRepository(Workspace).update(workspaceId, { ownerId: targetId, updatedAt: new Date() });
    });
  }

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

  async assertOwner(workspaceId: string, userId: string, writable = false): Promise<void> {
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
    if (writable) assertWorkspaceWritable(workspace);
  }

  async update(
    workspaceId: string,
    userId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    if (dto.name === undefined && dto.description === undefined && dto.reportingTimeZone === undefined) {
      throw new BadRequestException('No changes provided');
    }

    return this.updateOwnedWorkspace(workspaceId, userId, () => ({
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.reportingTimeZone !== undefined && { reportingTimeZone: validateWorkspaceTimeZone(dto.reportingTimeZone) }),
    }), true);
  }

  archive(workspaceId: string, userId: string): Promise<WorkspaceResponseDto> {
    return this.updateOwnedWorkspace(workspaceId, userId, workspace => ({ archivedAt: workspace.archivedAt ?? new Date() }));
  }

  unarchive(workspaceId: string, userId: string): Promise<WorkspaceResponseDto> {
    return this.updateOwnedWorkspace(workspaceId, userId, () => ({ archivedAt: null }));
  }

  async softDelete(workspaceId: string, userId: string): Promise<void> {
    await this.updateOwnedWorkspace(workspaceId, userId, () => ({ deletedAt: new Date() }), true);
  }

  private async updateOwnedWorkspace(
    workspaceId: string,
    userId: string,
    getChanges: (workspace: Workspace) => Partial<Workspace>,
    writable = false,
  ): Promise<WorkspaceResponseDto> {
    const repository = this.dataSource.getRepository(Workspace);
    const workspace = await repository.findOne({ where: { id: workspaceId, deletedAt: IsNull() } });
    if (!workspace) throw new NotFoundException('Workspace not found');
    if (workspace.ownerId !== userId) throw new ForbiddenException();
    if (writable) assertWorkspaceWritable(workspace);
    const changes = { ...getChanges(workspace), updatedAt: new Date() };
    const result = await repository.update({
      id: workspaceId, ownerId: userId, deletedAt: IsNull(),
      ...(writable && { archivedAt: IsNull() }),
    }, changes);
    if (!result.affected) throw new ConflictException('Workspace changed. Refresh and try again.');
    return WorkspaceMapper.toResponse({ ...workspace, ...changes });
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
    leaving = false,
  ): Promise<void> {
    const membershipId = await this.dataSource.transaction(async manager => {
      const workspace = await this.lockWorkspace(manager, workspaceId);
      if (leaving ? memberUserId !== currentUserId : workspace.ownerId !== currentUserId) throw new ForbiddenException();
      if (!leaving) assertWorkspaceWritable(workspace);
      if (workspace.ownerId === memberUserId) throw new BadRequestException('Transfer ownership before leaving or removing the owner');
      const memberships = manager.getRepository(WorkspaceMembership);
      const membership = await memberships.findOne({ where: { workspaceId, userId: memberUserId } });
      if (!membership) throw new NotFoundException('Workspace member not found');
      await manager.getRepository(TaskAssignment).createQueryBuilder().delete()
        .where('user_id = :memberUserId', { memberUserId })
        .andWhere('task_id IN (SELECT id FROM tasks WHERE workspace_id = :workspaceId)', { workspaceId })
        .execute();
      await memberships.remove(membership);
      return membership.id;
    });
    for (const listener of this.membershipRemovedListeners) listener(workspaceId, memberUserId);

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
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
    return invitations.map(invitation => WorkspaceInvitationMapper.toResponse(invitation));
  }

  async createInvitation(
    workspaceId: string,
    currentUserId: string,
    dto: CreateWorkspaceInvitationDto,
  ): Promise<WorkspaceInvitationResponseDto> {
    if (dto.invitedEmail && !dto.invitedUserId) {
      return this.issueEmailInvitation(workspaceId, currentUserId, dto.invitedEmail.trim().toLowerCase());
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

    if (workspace.ownerId !== currentUserId) {
      throw new ForbiddenException();
    }

    assertWorkspaceWritable(workspace);
    if (!dto.invitedUserId || dto.invitedEmail) {
      throw new BadRequestException('Provide one user ID or email address');
    }

    const invitedUserId = dto.invitedUserId;

    if (invitedUserId === currentUserId) {
      throw new BadRequestException('Workspace owner cannot invite themselves');
    }

    await this.usersService.findById(invitedUserId);

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
      invitedEmail: null,
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

  private invitationDigest(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async resendInvitation(workspaceId: string, actorId: string, invitationId: string) {
    return this.issueEmailInvitation(workspaceId, actorId, undefined, invitationId);
  }

  private async issueEmailInvitation(workspaceId: string, actorId: string, address?: string, invitationId?: string) {
    const token = randomBytes(32).toString('base64url');
    const { invitation, workspaceName } = await this.dataSource.transaction(async manager => {
      const workspace = await this.lockWorkspace(manager, workspaceId);
      if (workspace.ownerId !== actorId) throw new ForbiddenException();
      assertWorkspaceWritable(workspace);
      const repository = manager.getRepository(WorkspaceInvitation);
      const previous = invitationId ? await repository.findOneBy({ id: invitationId, workspaceId }) : null;
      if (invitationId && !previous) throw new NotFoundException('Invitation not found');
      if (previous && ![InvitationStatus.PENDING, InvitationStatus.EXPIRED].includes(previous.status)) {
        throw new ConflictException('Only pending or expired invitations can be resent');
      }
      const email = address ?? previous?.invitedEmail;
      if (!email) throw new BadRequestException('This invitation has no email address');
      const account = await this.usersService.findByEmail(email);
      if (account?.id === actorId) throw new BadRequestException('Workspace owner cannot invite themselves');
      if (account && await manager.getRepository(WorkspaceMembership).findOneBy({ workspaceId, userId: account.id })) {
        throw new ConflictException('User is already a workspace member');
      }
      const now = new Date();
      if (!previous && await repository.findOneBy({ workspaceId, invitedEmail: email, status: InvitationStatus.PENDING })) {
        throw new ConflictException('Pending invitation already exists');
      }
      const invitation = repository.create({
        id: previous?.id ?? randomUUID(),
        workspaceId,
        invitedById: actorId,
        invitedUserId: account?.id ?? null,
        invitedEmail: email,
        status: InvitationStatus.PENDING,
        tokenHash: this.invitationDigest(token),
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        respondedAt: null,
        createdAt: previous?.createdAt ?? now,
      });
      return { invitation: await repository.save(invitation), workspaceName: workspace.name };
    });
    const invitePath = '/join-workspace#' + new URLSearchParams({ workspace: workspaceId, invitation: invitation.id, token });
    const sent = await this.sendInvitationEmail(invitation.invitedEmail!, workspaceName, invitePath);
    return { ...WorkspaceInvitationMapper.toResponse(invitation), invitePath, delivery: sent ? 'sent' as const : 'link' as const };
  }

  private async sendInvitationEmail(email: string, workspaceName: string, invitePath: string) {
    const { RESEND_API_KEY: key, AUTH_EMAIL_FROM: from, AUTH_PUBLIC_URL: origin } = process.env;
    if (!key || !from || !origin) return false;
    try {
      const url = new URL(invitePath, origin);
      if (url.username || url.password || (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) return false;
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [email], subject: 'You were invited to a DevUP workspace', text: `Join ${workspaceName} on DevUP:\n\n${url.href}\n\nThis invitation expires in seven days.` }),
        signal: AbortSignal.timeout(10_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async acceptInvitation(
    workspaceId: string,
    invitationId: string,
    currentUserId: string,
    token?: string,
  ): Promise<WorkspaceInvitationResponseDto> {
    const account = token ? await this.usersService.findById(currentUserId) : undefined;
    const result = await this.dataSource.transaction(async (manager) => {
      const workspaceRepository = manager.getRepository(Workspace);

      const invitationRepository = manager.getRepository(WorkspaceInvitation);

      const membershipRepository = manager.getRepository(WorkspaceMembership);

      const workspace = await workspaceRepository.findOne({
        where: {
          id: workspaceId,
          deletedAt: IsNull(),
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!workspace) {
        throw new NotFoundException('Workspace not found');
      }

      const invitation = await invitationRepository.findOne({
        where: {
          id: invitationId,
          workspaceId,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!invitation) {
        throw new NotFoundException('Invitation not found');
      }

      if (token ? !invitation.tokenHash || invitation.tokenHash !== this.invitationDigest(token)
        || account?.email.toLowerCase() !== invitation.invitedEmail
        || (invitation.invitedUserId !== null && invitation.invitedUserId !== currentUserId)
        : invitation.invitedUserId !== currentUserId || Boolean(invitation.tokenHash)) {
        throw new ForbiddenException();
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new ConflictException('Invitation is no longer pending');
      }
      if (invitation.expiresAt && invitation.expiresAt <= new Date()) {
        throw new ConflictException('Invitation has expired. Ask the workspace owner to resend it.');
      }
      assertWorkspaceWritable(workspace);

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
      invitation.invitedUserId = currentUserId;
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

    const respondedAt = new Date();
    if (invitation.tokenHash) {
      const result = await invitationRepository.update(
        { id: invitationId, status: InvitationStatus.PENDING, tokenHash: invitation.tokenHash },
        { status: InvitationStatus.CANCELLED, respondedAt },
      );
      if (!result.affected) throw new ConflictException('Invitation changed. Refresh and try again.');
      return WorkspaceInvitationMapper.toResponse({ ...invitation, status: InvitationStatus.CANCELLED, respondedAt });
    }
    invitation.status = InvitationStatus.CANCELLED;
    invitation.respondedAt = respondedAt;
    return WorkspaceInvitationMapper.toResponse(await invitationRepository.save(invitation));
  }

  async getKanbanSettings(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceKanbanSettingsResponseDto> {
    const workspace = await this.findOneForUser(workspaceId, userId);

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

    return { ...WorkspaceKanbanSettingsMapper.toResponse(settings), ...(workspace?.reportingTimeZone && { reportingTimeZone: workspace.reportingTimeZone }) };
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

    assertWorkspaceWritable(workspace);
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
        const previousCounts = new Map<string, number>();
        for (const task of tasks) {
          const id = taskColumn(previous, task.status, task.boardColumnId).id;
          previousCounts.set(id, (previousCounts.get(id) ?? 0) + 1);
        }
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
        if (columns.some(column => {
          const count = counts.get(column.id) ?? 0;
          if (!column.limit || count <= column.limit) return false;
          const previousLimit = previous.find(item => item.id === column.id)?.limit;
          return !previousLimit || column.limit < previousLimit || count > (previousCounts.get(column.id) ?? 0);
        })) {
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

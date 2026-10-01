import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, IsNull } from 'typeorm';

import { InvitationStatus } from '../../../database/enums/database.enums';
import { UsersService } from '../../users/services/users.service';
import { CreateWorkspaceInvitationDto } from '../dto/create-workspace-invitation.dto';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
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
  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
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

  async findAllForUser(
    userId: string,
  ): Promise<WorkspaceResponseDto[]> {
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

    return workspaces.map((workspace) =>
      WorkspaceMapper.toResponse(workspace),
    );
  }

  async findOneForUser(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceResponseDto> {
    const workspace = await this.dataSource
      .getRepository(Workspace)
      .findOne({
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

  async update(
    workspaceId: string,
    userId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    if (
      dto.name === undefined &&
      dto.description === undefined
    ) {
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


  async softDelete(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
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
    const workspace = await this.findOneForUser(
      workspaceId,
      userId,
    );

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
    const workspaceRepository =
      this.dataSource.getRepository(Workspace);

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
      throw new BadRequestException(
        'Workspace owner cannot be removed',
      );
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

    await membershipRepository.remove(membership);
  }


  async createInvitation(
    workspaceId: string,
    currentUserId: string,
    dto: CreateWorkspaceInvitationDto,
  ): Promise<WorkspaceInvitationResponseDto> {
    const workspaceRepository =
      this.dataSource.getRepository(Workspace);

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

    if (dto.invitedUserId === currentUserId) {
      throw new BadRequestException(
        'Workspace owner cannot invite themselves',
      );
    }

    await this.usersService.findById(dto.invitedUserId);

    const membershipRepository =
      this.dataSource.getRepository(WorkspaceMembership);

    const existingMembership =
      await membershipRepository.findOne({
        where: {
          workspaceId,
          userId: dto.invitedUserId,
        },
      });

    if (existingMembership) {
      throw new ConflictException(
        'User is already a workspace member',
      );
    }

    const invitationRepository =
      this.dataSource.getRepository(WorkspaceInvitation);

    const existingInvitation =
      await invitationRepository.findOne({
        where: {
          workspaceId,
          invitedUserId: dto.invitedUserId,
          status: InvitationStatus.PENDING,
        },
      });

    if (existingInvitation) {
      throw new ConflictException(
        'Pending invitation already exists',
      );
    }

    const invitation = invitationRepository.create({
      id: randomUUID(),
      workspaceId,
      invitedById: currentUserId,
      invitedUserId: dto.invitedUserId,
      invitedEmail: null,
      status: InvitationStatus.PENDING,
      tokenHash: null,
      expiresAt: null,
      respondedAt: null,
      createdAt: new Date(),
    });

    const savedInvitation =
      await invitationRepository.save(invitation);

    return WorkspaceInvitationMapper.toResponse(
      savedInvitation,
    );
  }


  async acceptInvitation(
    workspaceId: string,
    invitationId: string,
    currentUserId: string,
  ): Promise<WorkspaceInvitationResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const workspaceRepository =
        manager.getRepository(Workspace);

      const invitationRepository =
        manager.getRepository(WorkspaceInvitation);

      const membershipRepository =
        manager.getRepository(WorkspaceMembership);

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
        throw new ConflictException(
          'Invitation is no longer pending',
        );
      }

      const existingMembership =
        await membershipRepository.findOne({
          where: {
            workspaceId,
            userId: currentUserId,
          },
        });

      if (existingMembership) {
        throw new ConflictException(
          'User is already a workspace member',
        );
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

      const savedInvitation =
        await invitationRepository.save(invitation);

      return WorkspaceInvitationMapper.toResponse(
        savedInvitation,
      );
    });
  }


  async rejectInvitation(
    workspaceId: string,
    invitationId: string,
    currentUserId: string,
  ): Promise<WorkspaceInvitationResponseDto> {
    const workspaceRepository =
      this.dataSource.getRepository(Workspace);

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
      throw new ConflictException(
        'Invitation is no longer pending',
      );
    }

    invitation.status = InvitationStatus.REJECTED;
    invitation.respondedAt = new Date();

    const savedInvitation =
      await invitationRepository.save(invitation);

    return WorkspaceInvitationMapper.toResponse(
      savedInvitation,
    );
  }


  async cancelInvitation(
    workspaceId: string,
    invitationId: string,
    currentUserId: string,
  ): Promise<WorkspaceInvitationResponseDto> {
    const workspaceRepository =
      this.dataSource.getRepository(Workspace);

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
      throw new ConflictException(
        'Invitation is no longer pending',
      );
    }

    invitation.status = InvitationStatus.CANCELLED;
    invitation.respondedAt = new Date();

    const savedInvitation =
      await invitationRepository.save(invitation);

    return WorkspaceInvitationMapper.toResponse(
      savedInvitation,
    );
  }


  async getKanbanSettings(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceKanbanSettingsResponseDto> {
    await this.findOneForUser(workspaceId, userId);

    const settingsRepository =
      this.dataSource.getRepository(WorkspaceKanbanSetting);

    const settings = await settingsRepository.findOne({
      where: {
        workspaceId,
      },
    });

    if (!settings) {
      throw new NotFoundException(
        'Kanban settings not found',
      );
    }

    return WorkspaceKanbanSettingsMapper.toResponse(
      settings,
    );
  }


  async updateKanbanSettings(
    workspaceId: string,
    userId: string,
    dto: UpdateWorkspaceKanbanSettingsDto,
  ): Promise<WorkspaceKanbanSettingsResponseDto> {
    if (
      dto.activeWipLimit === undefined &&
      dto.definitionOfReady === undefined &&
      dto.definitionOfDone === undefined
    ) {
      throw new BadRequestException('No changes provided');
    }

    const workspaceRepository =
      this.dataSource.getRepository(Workspace);

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

    const settingsRepository =
      this.dataSource.getRepository(WorkspaceKanbanSetting);

    const settings = await settingsRepository.findOne({
      where: {
        workspaceId,
      },
    });

    if (!settings) {
      throw new NotFoundException(
        'Kanban settings not found',
      );
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

    const savedSettings =
      await settingsRepository.save(settings);

    return WorkspaceKanbanSettingsMapper.toResponse(
      savedSettings,
    );
  }

}

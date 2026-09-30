import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, IsNull } from 'typeorm';

import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import { WorkspaceMemberResponseDto } from '../dto/workspace-member-response.dto';
import { WorkspaceResponseDto } from '../dto/workspace-response.dto';
import { WorkspaceKanbanSetting } from '../entities/workspace-kanban-setting.entity';
import { WorkspaceMembership } from '../entities/workspace-membership.entity';
import { Workspace } from '../entities/workspace.entity';
import { WorkspaceMapper } from '../mappers/workspace.mapper';

@Injectable()
export class WorkspacesService {
  constructor(private readonly dataSource: DataSource) {}

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

}

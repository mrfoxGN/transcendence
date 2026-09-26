import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
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
}

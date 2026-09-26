import { WorkspaceResponseDto } from '../dto/workspace-response.dto';
import { Workspace } from '../entities/workspace.entity';

export class WorkspaceMapper {
  static toResponse(workspace: Workspace): WorkspaceResponseDto {
    return {
      id: workspace.id,
      ownerId: workspace.ownerId,
      name: workspace.name,
      description: workspace.description,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      archivedAt: workspace.archivedAt,
    };
  }
}

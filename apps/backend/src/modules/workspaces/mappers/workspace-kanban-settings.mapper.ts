import { WorkspaceKanbanSetting } from '../entities/workspace-kanban-setting.entity';
import { WorkspaceKanbanSettingsResponseDto } from '../dto/workspace-kanban-settings-response.dto';

export class WorkspaceKanbanSettingsMapper {
  static toResponse(
    settings: WorkspaceKanbanSetting,
  ): WorkspaceKanbanSettingsResponseDto {
    return {
      workspaceId: settings.workspaceId,
      activeWipLimit: settings.activeWipLimit,
      definitionOfReady: settings.definitionOfReady,
      definitionOfDone: settings.definitionOfDone,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }
}

export class WorkspaceKanbanSettingsResponseDto {
  workspaceId!: string;
  reportingTimeZone?: string;
  activeWipLimit!: number;
  definitionOfReady!: unknown;
  definitionOfDone!: unknown;
  boardColumns?: import('./update-workspace-kanban-settings.dto').BoardColumnDto[];
  createdAt!: Date;
  updatedAt!: Date;
}

export class WorkspaceKanbanSettingsResponseDto {
  workspaceId!: string;
  reportingTimeZone?: string;
  activeWipLimit!: number;
  definitionOfReady!: unknown;
  definitionOfDone!: unknown;
  createdAt!: Date;
  updatedAt!: Date;
}

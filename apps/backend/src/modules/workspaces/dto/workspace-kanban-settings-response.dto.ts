export class WorkspaceKanbanSettingsResponseDto {
  workspaceId!: string;
  activeWipLimit!: number;
  definitionOfReady!: unknown;
  definitionOfDone!: unknown;
  createdAt!: Date;
  updatedAt!: Date;
}

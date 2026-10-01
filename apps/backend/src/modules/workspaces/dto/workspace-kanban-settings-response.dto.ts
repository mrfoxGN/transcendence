export class WorkspaceKanbanSettingsResponseDto {
  workspaceId!: string;
  activeWipLimit!: number;
  definitionOfReady!: unknown | null;
  definitionOfDone!: unknown | null;
  createdAt!: Date;
  updatedAt!: Date;
}

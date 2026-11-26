import type { WorkspaceFile } from './workspace-api';
import { useWorkspaceDocumentCollection } from './workspace-documents';

export function useWorkspaceFiles(path: string, token: string | null) {
  return useWorkspaceDocumentCollection<WorkspaceFile>(path, token);
}

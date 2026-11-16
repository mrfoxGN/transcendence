import { jsonRequest, workspaceRequest } from './workspace-api';
import { statusLabels } from './workspace-tasks';

export const projectStatusLabels = { planned: 'Planned', active: 'Active', 'on-hold': 'On hold', completed: 'Completed' };
export type ProjectStatus = keyof typeof projectStatusLabels;
export type ProjectProgress = { done: number; total: number };
export type ProjectTask = { id: string; taskNumber: number; title: string; status: keyof typeof statusLabels; milestoneId: string | null };
export type Milestone = { id: string; name: string; targetDate: string | null; progress: ProjectProgress };
export type Project = {
  id: string; name: string; ownerId: string | null; targetDate: string | null; status: ProjectStatus;
  milestones: Milestone[]; tasks: ProjectTask[]; progress: ProjectProgress;
};

export function linkProjectTask(path: string, token: string | null, taskId: string, projectId: string | null, milestoneId: string | null = null, onlyUngrouped = false) {
  return workspaceRequest(path + '/task-links/' + taskId, token, jsonRequest('PUT', { projectId, milestoneId, onlyUngrouped }));
}

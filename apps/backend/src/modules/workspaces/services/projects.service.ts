import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, IsNull, type EntityManager } from 'typeorm';
import { TaskStatus } from '../../../database/enums/database.enums';
import { Task } from '../../tasks/entities/task.entity';
import type { MilestoneDto, ProjectDto, ProjectStatus, TaskProjectDto } from '../dto/project.dto';
import { WorkspaceMembership } from '../entities/workspace-membership.entity';
import { WorkspacesService } from './workspaces.service';

type ProjectRow = { id: string; name: string; ownerId: string | null; targetDate: string | null; status: ProjectStatus };
type MilestoneRow = { id: string; projectId: string; name: string; targetDate: string | null };
type LinkedTask = { id: string; taskNumber: number; title: string; status: TaskStatus; projectId: string; milestoneId: string | null };
type Progress = { done: number; total: number };
type Milestone = MilestoneRow & { progress: Progress };
type Project = ProjectRow & { milestones: Milestone[]; tasks: LinkedTask[]; progress: Progress };

function countTask(progress: Progress, status: TaskStatus) {
  if (status === TaskStatus.CANCELLED) return;
  progress.total++;
  if (status === TaskStatus.DONE) progress.done++;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly dataSource: DataSource, private readonly workspaces: WorkspacesService) {}

  async list(workspaceId: string, userId: string): Promise<Project[]> {
    await this.workspaces.findOneForUser(workspaceId, userId);
    return this.dataSource.transaction(async manager => {
      const rows = await manager.query<ProjectRow[]>(`
        SELECT p.id, p.name, m.user_id AS ownerId, DATE_FORMAT(p.target_date, '%Y-%m-%d') AS targetDate, p.status
        FROM workspace_projects p LEFT JOIN workspace_memberships m ON m.id = p.owner_membership_id
        WHERE p.workspace_id = ? ORDER BY p.created_at DESC, p.id`, [workspaceId]);
      if (!rows.length) return [];

      const projects = new Map(rows.map(row => [row.id, { ...row, milestones: [], tasks: [], progress: { done: 0, total: 0 } } as Project]));
      const milestones = new Map<string, Milestone>();
      const milestoneRows = await manager.query<MilestoneRow[]>(`
        SELECT m.id, m.project_id AS projectId, m.name, DATE_FORMAT(m.target_date, '%Y-%m-%d') AS targetDate
        FROM project_milestones m INNER JOIN workspace_projects p ON p.id = m.project_id
        WHERE p.workspace_id = ? ORDER BY m.target_date IS NULL, m.target_date, m.created_at, m.id`, [workspaceId]);
      for (const row of milestoneRows) {
        const milestone = { ...row, progress: { done: 0, total: 0 } };
        milestones.set(row.id, milestone);
        projects.get(row.projectId)?.milestones.push(milestone);
      }
      const tasks = await manager.query<LinkedTask[]>(`
        SELECT t.id, t.task_number AS taskNumber, t.title, t.status, l.project_id AS projectId, l.milestone_id AS milestoneId
        FROM project_task_links l INNER JOIN workspace_projects p ON p.id = l.project_id
        INNER JOIN tasks t ON t.id = l.task_id AND t.workspace_id = p.workspace_id
        WHERE p.workspace_id = ? AND t.deleted_at IS NULL ORDER BY t.task_number, t.id`, [workspaceId]);
      for (const task of tasks) {
        const project = projects.get(task.projectId);
        if (!project) continue;
        project.tasks.push(task);
        countTask(project.progress, task.status);
        const milestone = task.milestoneId && milestones.get(task.milestoneId);
        if (milestone) countTask(milestone.progress, task.status);
      }
      return Array.from(projects.values());
    });
  }

  private write<T>(workspaceId: string, userId: string, action: (manager: EntityManager) => Promise<T>) {
    return this.dataSource.transaction(async manager => {
      await this.workspaces.lockWritableWorkspaceForMember(manager, workspaceId, userId);
      return action(manager);
    });
  }

  private async requireProject(manager: EntityManager, workspaceId: string, projectId: string) {
    const rows = await manager.query<{ id: string }[]>('SELECT id FROM workspace_projects WHERE id = ? AND workspace_id = ?', [projectId, workspaceId]);
    if (!rows.length) throw new NotFoundException('Project not found.');
  }

  private async requireMilestone(manager: EntityManager, projectId: string, milestoneId: string) {
    const rows = await manager.query<{ id: string }[]>('SELECT id FROM project_milestones WHERE id = ? AND project_id = ?', [milestoneId, projectId]);
    if (!rows.length) throw new NotFoundException('Milestone not found in this project.');
  }

  saveProject(workspaceId: string, userId: string, dto: ProjectDto, projectId?: string) {
    return this.write(workspaceId, userId, async manager => {
      if (projectId) await this.requireProject(manager, workspaceId, projectId);
      const owner = dto.ownerId ? await manager.getRepository(WorkspaceMembership).findOneBy({ workspaceId, userId: dto.ownerId }) : null;
      if (dto.ownerId && !owner) throw new BadRequestException('Choose a workspace member as the project owner.');
      const id = projectId ?? randomUUID();
      const values = [dto.name.trim(), dto.targetDate ?? null, dto.status, owner?.id ?? null];
      if (projectId) {
        await manager.query('UPDATE workspace_projects SET name = ?, target_date = ?, status = ?, owner_membership_id = ? WHERE id = ?', [...values, id]);
      } else {
        await manager.query('INSERT INTO workspace_projects (name, target_date, status, owner_membership_id, id, workspace_id) VALUES (?, ?, ?, ?, ?, ?)', [...values, id, workspaceId]);
      }
      return { id };
    });
  }

  removeProject(workspaceId: string, userId: string, projectId: string) {
    return this.write(workspaceId, userId, async manager => {
      await this.requireProject(manager, workspaceId, projectId);
      await manager.query('DELETE FROM workspace_projects WHERE id = ?', [projectId]);
    });
  }

  saveMilestone(workspaceId: string, userId: string, projectId: string, dto: MilestoneDto, milestoneId?: string) {
    return this.write(workspaceId, userId, async manager => {
      await this.requireProject(manager, workspaceId, projectId);
      const id = milestoneId ?? randomUUID();
      const values = [dto.name.trim(), dto.targetDate ?? null, id];
      if (milestoneId) {
        await this.requireMilestone(manager, projectId, milestoneId);
        await manager.query('UPDATE project_milestones SET name = ?, target_date = ? WHERE id = ?', values);
      } else {
        await manager.query('INSERT INTO project_milestones (name, target_date, id, project_id) VALUES (?, ?, ?, ?)', [...values, projectId]);
      }
      return { id };
    });
  }

  removeMilestone(workspaceId: string, userId: string, projectId: string, milestoneId: string) {
    return this.write(workspaceId, userId, async manager => {
      await this.requireProject(manager, workspaceId, projectId);
      await this.requireMilestone(manager, projectId, milestoneId);
      await manager.query('DELETE FROM project_milestones WHERE id = ?', [milestoneId]);
    });
  }

  linkTask(workspaceId: string, userId: string, taskId: string, dto: TaskProjectDto) {
    return this.write(workspaceId, userId, async manager => {
      const task = await manager.getRepository(Task).findOne({
        where: { id: taskId, workspaceId, deletedAt: IsNull() }, lock: { mode: 'pessimistic_write' },
      });
      if (!task) throw new NotFoundException('Task not found.');
      if (dto.projectId === undefined) throw new BadRequestException('Choose a project or explicitly unlink this task.');
      if (!dto.projectId) {
        if (dto.milestoneId) throw new BadRequestException('Choose a project before adding a milestone.');
        await manager.query('DELETE FROM project_task_links WHERE task_id = ?', [taskId]);
        return;
      }
      await this.requireProject(manager, workspaceId, dto.projectId);
      if (dto.milestoneId) await this.requireMilestone(manager, dto.projectId, dto.milestoneId);
      if (dto.onlyUngrouped) {
        const [existing] = await manager.query<{ projectId: string; milestoneId: string | null }[]>(
          'SELECT project_id AS projectId, milestone_id AS milestoneId FROM project_task_links WHERE task_id = ?', [taskId],
        );
        if (existing?.projectId === dto.projectId && existing.milestoneId === (dto.milestoneId ?? null)) return;
        if (existing) throw new ConflictException('This task is already linked. Open the task to change its project or milestone.');
      }
      await manager.query(`
        INSERT INTO project_task_links (task_id, project_id, milestone_id) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE project_id = ?, milestone_id = ?`,
      [taskId, dto.projectId, dto.milestoneId ?? null, dto.projectId, dto.milestoneId ?? null]);
    });
  }
}

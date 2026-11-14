import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, IsNull, LessThanOrEqual, MoreThan, Or } from 'typeorm';
import { WorkspacesService } from '../../workspaces/services/workspaces.service';
import { defaultWorkspaceTimeZone } from '../../workspaces/workspace-policy';
import { Task } from '../entities/task.entity';
import { TaskStatusHistory } from '../entities/task-status-history.entity';
import { analyticsWindow, buildAnalytics } from '../task-analytics';

@Injectable()
export class TaskAnalyticsService {
  constructor(private readonly dataSource: DataSource, private readonly workspaces: WorkspacesService) {}

  async report(workspaceId: string, userId: string, days: number, day?: string, asOf?: string) {
    const workspace = await this.workspaces.findOneForUser(workspaceId, userId);
    const now = asOf ? new Date(asOf) : new Date();
    if (!Number.isFinite(now.getTime()) || now.getTime() > Date.now()) throw new BadRequestException('Invalid report timestamp.');
    const window = analyticsWindow(now, days, workspace.reportingTimeZone ?? defaultWorkspaceTimeZone);
    const flowDay = day ?? window.today;
    if (!window.points.some(point => point.day === flowDay)) throw new BadRequestException('Choose a day in the report period.');
    return this.dataSource.transaction(async manager => {
      const start = new Date(window.start);
      const tasks = await manager.getRepository(Task).find({
        where: { workspaceId, createdAt: LessThanOrEqual(now), deletedAt: Or(IsNull(), MoreThan(start)) },
        select: { id: true, title: true, taskNumber: true, status: true, createdAt: true, completedAt: true, cancelledAt: true, deletedAt: true },
        order: { taskNumber: 'ASC' },
      });
      const history = await manager.getRepository(TaskStatusHistory).createQueryBuilder('event')
        .innerJoin(Task, 'task', 'task.id = event.taskId')
        .where('task.workspaceId = :workspaceId', { workspaceId })
        .andWhere('task.createdAt <= :now', { now })
        .andWhere('(task.deletedAt IS NULL OR task.deletedAt > :start)', { start })
        .select(['event.id', 'event.taskId', 'event.changedAt', 'event.fromStatus', 'event.toStatus'])
        .orderBy('event.changedAt', 'ASC').addOrderBy('event.id', 'ASC')
        .getMany();
      return buildAnalytics(tasks, history, window, flowDay);
    });
  }
}

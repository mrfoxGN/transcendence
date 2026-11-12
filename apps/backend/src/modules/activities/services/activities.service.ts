import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { And, LessThan, MoreThanOrEqual, Raw, Repository } from 'typeorm';

import { ActivityResponseDto } from '../dto/activity-response.dto';
import { ListActivitiesDto } from '../dto/list-activities.dto';
import { Activity } from '../entities/activity.entity';

const categoryPrefixes = { tasks: 'TASK', files: 'FILE', members: 'MEMBER', notes: 'NOTE', board: 'BOARD', github: 'GITHUB' };
const resourceTables = { task: 'tasks', workspace_file: 'workspace_files', note: 'notes' } as const;

export interface CreateActivityInput {
  workspaceId: string;
  actorUserId?: string | null;
  actionType: string;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: unknown;
}

export function activityEntry(input: CreateActivityInput) {
  return {
    id: randomUUID(), workspaceId: input.workspaceId, actorUserId: input.actorUserId ?? null,
    actionType: input.actionType, resourceType: input.resourceType ?? null, resourceId: input.resourceId ?? null,
    metadata: input.metadata ?? null, createdAt: new Date(),
  };
}

export async function recordActivity(service: ActivitiesService, input: CreateActivityInput) {
  try { await service.create(input); }
  catch (error) {
    new Logger(ActivitiesService.name).error('Could not record ' + input.actionType, error instanceof Error ? error.stack : undefined);
  }
}

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(Activity)
    private readonly activitiesRepository: Repository<Activity>,
  ) {}

  async create(input: CreateActivityInput): Promise<ActivityResponseDto> {
    const activity = this.activitiesRepository.create(activityEntry(input));

    const saved = await this.activitiesRepository.save(activity);

    return this.toResponse(saved);
  }

  async findAllForWorkspace(
    workspaceId: string,
    query: ListActivitiesDto,
  ): Promise<ActivityResponseDto[]> {
    return this.findActivities(workspaceId, query, 0);
  }

  async findPageForWorkspace(workspaceId: string, query: ListActivitiesDto, audit = false) {
    const limit = query.limit ?? 20;
    const activities = await this.findActivities(workspaceId, query, 1, audit);
    return { items: activities.slice(0, limit), hasNext: activities.length > limit };
  }

  private async findActivities(workspaceId: string, query: ListActivitiesDto, lookahead: number, audit = false) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    if (!Number.isSafeInteger(skip)) throw new BadRequestException('Invalid page');

    const from = query.from ? new Date(query.from) : undefined;
    const before = query.before ? new Date(query.before) : undefined;
    if (from && before && from >= before) {
      throw new BadRequestException('The start must be before the end');
    }
    const lower = from && MoreThanOrEqual(from);
    const upper = before && LessThan(before);
    const createdAt = lower && upper ? And(lower, upper) : lower ?? upper;
    const prefix = audit ? 'AUDIT' : query.category ? categoryPrefixes[query.category] : 'AUDIT';
    const operator = audit || query.category ? 'LIKE' : 'NOT LIKE';
    const actionType = Raw(
      (column) => `(${column} ${operator} :activityPrefix ESCAPE '!' ${audit ? 'OR' : 'AND'} ${column} ${audit ? '=' : '<>'} 'MEMBER_REMOVED')`,
      { activityPrefix: prefix + '!_%' },
    );

    const activities = await this.activitiesRepository.find({
      where: {
        workspaceId,
        actionType,
        ...(query.actorUserId && { actorUserId: query.actorUserId }),
        ...(createdAt && { createdAt }),
      },
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip,
      take: limit + lookahead,
    });

    const result = activities.map(activity => this.toResponse(activity));
    await Promise.all(Object.entries(resourceTables).map(async ([type, table]) => {
      const related = result.filter(activity => activity.resourceType === type && activity.resourceId);
      if (!related.length) return;
      const ids = [...new Set(related.map(activity => activity.resourceId))];
      const rows = await this.activitiesRepository.manager.query<{ id: string }[]>(
        `SELECT id FROM ${table} WHERE workspace_id = ? AND deleted_at IS NULL AND id IN (${ids.map(() => '?').join(',')})`,
        [workspaceId, ...ids],
      );
      const available = new Set(rows.map(row => row.id));
      for (const event of related) event.resourceState = available.has(event.resourceId!) ? 'available' : 'deleted';
    }));
    const subjects = result.map(event => {
      const metadata = event.metadata as { assigneeId?: unknown; memberUserId?: unknown } | null;
      const value = metadata?.assigneeId ?? metadata?.memberUserId;
      return typeof value === 'string' ? value : undefined;
    });
    const people = [...new Set([...result.map(event => event.actorUserId), ...subjects].filter(Boolean))];
    if (people.length) {
      const rows = await this.activitiesRepository.manager.query<{ id: string; username: string }[]>(
        `SELECT id, username FROM users WHERE id IN (${people.map(() => '?').join(',')})`, people,
      );
      const names = new Map(rows.map(row => [row.id, row.username]));
      result.forEach((event, index) => {
        const actor = event.actorUserId && names.get(event.actorUserId);
        const subject = subjects[index] && names.get(subjects[index]!);
        if (actor) event.actorName = actor;
        if (subject) event.subjectName = subject;
      });
    }
    return result;
  }

  private toResponse(activity: Activity): ActivityResponseDto {
    return {
      id: activity.id,
      workspaceId: activity.workspaceId,
      actorUserId: activity.actorUserId,
      actionType: activity.actionType,
      resourceType: activity.resourceType,
      resourceId: activity.resourceId,
      metadata: activity.metadata,
      createdAt: activity.createdAt,
    };
  }
}

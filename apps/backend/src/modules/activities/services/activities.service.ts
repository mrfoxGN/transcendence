import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import {
  And,
  FindOptionsWhere,
  LessThan,
  MoreThanOrEqual,
  Raw,
  Repository,
} from 'typeorm';

import { ActivityResponseDto } from '../dto/activity-response.dto';
import { ListActivitiesDto } from '../dto/list-activities.dto';
import { Activity } from '../entities/activity.entity';

const categoryPrefixes = {
  tasks: 'TASK',
  files: 'FILE',
  members: 'MEMBER',
  notes: 'NOTE',
  board: 'BOARD',
  github: 'GITHUB',
};
const resourceTables = {
  task: 'tasks',
  workspace_file: 'workspace_files',
  note: 'notes',
} as const;

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
    id: randomUUID(),
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId ?? null,
    actionType: input.actionType,
    resourceType: input.resourceType ?? null,
    resourceId: input.resourceId ?? null,
    metadata: input.metadata ?? null,
    createdAt: new Date(),
  };
}

export async function recordActivity(
  service: ActivitiesService,
  input: CreateActivityInput,
) {
  try {
    await service.create(input);
  } catch (error) {
    new Logger(ActivitiesService.name).error(
      'Could not record ' + input.actionType,
      error instanceof Error ? error.stack : undefined,
    );
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
    const limit = query.limit ?? 20;
    const activities = await this.findActivities(workspaceId, query, limit);
    return this.buildResponses(workspaceId, activities);
  }

  async findPageForWorkspace(
    workspaceId: string,
    query: ListActivitiesDto,
    audit = false,
  ): Promise<{ items: ActivityResponseDto[]; hasNext: boolean }> {
    const limit = query.limit ?? 20;
    // Fetch one extra row to see whether there is another page.
    const activities = await this.findActivities(
      workspaceId,
      query,
      limit + 1,
      audit,
    );

    return {
      items: await this.buildResponses(workspaceId, activities.slice(0, limit)),
      hasNext: activities.length > limit,
    };
  }

  private async findActivities(
    workspaceId: string,
    query: ListActivitiesDto,
    take: number,
    audit = false,
  ): Promise<Activity[]> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(skip)) {
      throw new BadRequestException('Invalid page');
    }

    const where: FindOptionsWhere<Activity> = {
      workspaceId,
      actionType: this.actionTypeFilter(query.category, audit),
    };

    if (query.actorUserId) {
      where.actorUserId = query.actorUserId;
    }

    const from = query.from ? new Date(query.from) : undefined;
    const before = query.before ? new Date(query.before) : undefined;

    if (from && before) {
      if (from >= before) {
        throw new BadRequestException('The start must be before the end');
      }

      where.createdAt = And(MoreThanOrEqual(from), LessThan(before));
    } else if (from) {
      where.createdAt = MoreThanOrEqual(from);
    } else if (before) {
      where.createdAt = LessThan(before);
    }

    return this.activitiesRepository.find({
      where,
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip,
      take,
    });
  }

  private actionTypeFilter(
    category: ListActivitiesDto['category'],
    audit: boolean,
  ) {
    // MEMBER_REMOVED is the action stored by older versions for member removals.
    if (audit) {
      return Raw(
        (column) =>
          `(${column} LIKE :activityPrefix ESCAPE '!' OR ${column} = 'MEMBER_REMOVED')`,
        { activityPrefix: 'AUDIT!_%' },
      );
    }

    const operator = category ? 'LIKE' : 'NOT LIKE';
    const prefix = category ? categoryPrefixes[category] : 'AUDIT';

    return Raw(
      (column) =>
        `(${column} ${operator} :activityPrefix ESCAPE '!' AND ${column} <> 'MEMBER_REMOVED')`,
      { activityPrefix: prefix + '!_%' },
    );
  }

  private async buildResponses(
    workspaceId: string,
    activities: Activity[],
  ): Promise<ActivityResponseDto[]> {
    const responses = activities.map((activity) => this.toResponse(activity));

    await this.addResourceStates(workspaceId, responses);
    await this.addUserNames(responses);

    return responses;
  }

  private async addResourceStates(
    workspaceId: string,
    responses: ActivityResponseDto[],
  ): Promise<void> {
    await Promise.all(
      Object.entries(resourceTables).map(async ([resourceType, table]) => {
        const resourceIds = new Set<string>();

        for (const activity of responses) {
          if (activity.resourceType === resourceType && activity.resourceId) {
            resourceIds.add(activity.resourceId);
          }
        }

        if (resourceIds.size === 0) {
          return;
        }

        const ids = [...resourceIds];
        const placeholders = ids.map(() => '?').join(', ');
        const rows = await this.activitiesRepository.manager.query<
          { id: string }[]
        >(
          `SELECT id FROM ${table}
           WHERE workspace_id = ? AND deleted_at IS NULL
             AND id IN (${placeholders})`,
          [workspaceId, ...ids],
        );

        const availableIds = new Set(rows.map((row) => row.id));

        for (const activity of responses) {
          if (activity.resourceType === resourceType && activity.resourceId) {
            activity.resourceState = availableIds.has(activity.resourceId)
              ? 'available'
              : 'deleted';
          }
        }
      }),
    );
  }

  private async addUserNames(responses: ActivityResponseDto[]): Promise<void> {
    const userIds = new Set<string>();

    for (const activity of responses) {
      const subjectUserId = this.getSubjectUserId(activity);

      if (activity.actorUserId) {
        userIds.add(activity.actorUserId);
      }
      if (subjectUserId) {
        userIds.add(subjectUserId);
      }
    }

    if (userIds.size === 0) {
      return;
    }

    const ids = [...userIds];
    const placeholders = ids.map(() => '?').join(', ');
    const users = await this.activitiesRepository.manager.query<
      { id: string; username: string }[]
    >(`SELECT id, username FROM users WHERE id IN (${placeholders})`, ids);
    const names = new Map(users.map((user) => [user.id, user.username]));

    for (const activity of responses) {
      const subjectUserId = this.getSubjectUserId(activity);
      const actorName = activity.actorUserId && names.get(activity.actorUserId);
      const subjectName = subjectUserId && names.get(subjectUserId);

      if (actorName) {
        activity.actorName = actorName;
      }
      if (subjectName) {
        activity.subjectName = subjectName;
      }
    }
  }

  private getSubjectUserId(activity: ActivityResponseDto): string | undefined {
    const metadata = activity.metadata as {
      assigneeId?: unknown;
      memberUserId?: unknown;
    } | null;
    const userId = metadata?.assigneeId ?? metadata?.memberUserId;

    return typeof userId === 'string' ? userId : undefined;
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

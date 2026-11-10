import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { And, LessThan, MoreThanOrEqual, Raw, Repository } from 'typeorm';

import { ActivityResponseDto } from '../dto/activity-response.dto';
import { ListActivitiesDto } from '../dto/list-activities.dto';
import { Activity } from '../entities/activity.entity';

const categoryPrefixes = { tasks: 'TASK', files: 'FILE', members: 'MEMBER' };

export interface CreateActivityInput {
  workspaceId: string;
  actorUserId?: string | null;
  actionType: string;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: unknown;
}

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(Activity)
    private readonly activitiesRepository: Repository<Activity>,
  ) {}

  async create(input: CreateActivityInput): Promise<ActivityResponseDto> {
    const activity = this.activitiesRepository.create({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId ?? null,
      actionType: input.actionType,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata ?? null,
      createdAt: new Date(),
    });

    const saved = await this.activitiesRepository.save(activity);

    return this.toResponse(saved);
  }

  async findAllForWorkspace(
    workspaceId: string,
    query: ListActivitiesDto,
  ): Promise<ActivityResponseDto[]> {
    return this.findActivities(workspaceId, query, 0);
  }

  async findPageForWorkspace(workspaceId: string, query: ListActivitiesDto) {
    const limit = query.limit ?? 20;
    const activities = await this.findActivities(workspaceId, query, 1);
    return { items: activities.slice(0, limit), hasNext: activities.length > limit };
  }

  private async findActivities(workspaceId: string, query: ListActivitiesDto, lookahead: number) {
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
    const actionType = query.category && Raw(
      (column) => `${column} LIKE :activityPrefix ESCAPE '!'`,
      { activityPrefix: categoryPrefixes[query.category] + '!_%' },
    );

    const activities = await this.activitiesRepository.find({
      where: {
        workspaceId,
        ...(actionType && { actionType }),
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

    return activities.map((activity) => this.toResponse(activity));
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

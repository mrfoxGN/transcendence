import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';

import { ActivityResponseDto } from '../dto/activity-response.dto';
import { ListActivitiesDto } from '../dto/list-activities.dto';
import { Activity } from '../entities/activity.entity';

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
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const activities = await this.activitiesRepository.find({
      where: {
        workspaceId,
      },
      order: {
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
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

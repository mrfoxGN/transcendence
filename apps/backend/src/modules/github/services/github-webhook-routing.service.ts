import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { Repository as ConnectedRepository } from '../entities/repository.entity';

export interface GitHubWebhookTarget {
  repositoryId: string;
  workspaceId: string;
  githubRepositoryId: string;
  fullName: string;
}

@Injectable()
export class GitHubWebhookRoutingService {
  constructor(
    @InjectRepository(ConnectedRepository)
    private readonly repositories: Repository<ConnectedRepository>,
  ) {}

  async resolveTargets(
    payload: unknown,
  ): Promise<GitHubWebhookTarget[]> {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      Array.isArray(payload)
    ) {
      throw new BadRequestException(
        'Invalid GitHub webhook payload',
      );
    }

    const data = payload as Record<string, unknown>;
    const repository = data.repository;

    if (
      typeof repository !== 'object' ||
      repository === null ||
      Array.isArray(repository)
    ) {
      throw new BadRequestException(
        'GitHub repository information is missing',
      );
    }

    const githubRepository = repository as Record<string, unknown>;
    const githubRepositoryId = githubRepository.id;

    if (
      typeof githubRepositoryId !== 'number' ||
      !Number.isSafeInteger(githubRepositoryId) ||
      githubRepositoryId <= 0
    ) {
      throw new BadRequestException(
        'Invalid GitHub repository ID',
      );
    }

    const connections = await this.repositories.find({
      where: {
        githubRepositoryId: String(githubRepositoryId),
        disconnectedAt: IsNull(),
      },
    });

    return connections.map((connection) => ({
      repositoryId: connection.id,
      workspaceId: connection.workspaceId,
      githubRepositoryId: connection.githubRepositoryId,
      fullName: connection.fullName,
    }));
  }
}

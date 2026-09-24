import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GitHubController } from './controllers/github.controller';
import { GitHubAccount } from './entities/github-account.entity';
import { GitHubInstallation } from './entities/github-installation.entity';
import { GitHubWebhookDelivery } from './entities/github-webhook-delivery.entity';
import { Repository } from './entities/repository.entity';
import { RepositoryCommit } from './entities/repository-commit.entity';
import { RepositoryEntry } from './entities/repository-entry.entity';
import { TaskRepositoryLink } from './entities/task-repository-link.entity';
import { GitHubService } from './services/github.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GitHubAccount,
      GitHubInstallation,
      Repository,
      RepositoryCommit,
      RepositoryEntry,
      TaskRepositoryLink,
      GitHubWebhookDelivery,
    ]),
  ],
  controllers: [GitHubController],
  providers: [GitHubService],
  exports: [GitHubService],
})
export class GitHubModule {}

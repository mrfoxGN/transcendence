import { UsersModule } from '../users/users.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GitHubController } from './controllers/github.controller';
import { GitHubWebhookController } from './controllers/github-webhook.controller';
import { WorkspaceGitHubController } from './controllers/workspace-github.controller';
import { GitHubAccount } from './entities/github-account.entity';
import { GitHubInstallation } from './entities/github-installation.entity';
import { GitHubWebhookDelivery } from './entities/github-webhook-delivery.entity';
import { Repository } from './entities/repository.entity';
import { RepositoryCommit } from './entities/repository-commit.entity';
import { RepositoryEntry } from './entities/repository-entry.entity';
import { TaskRepositoryLink } from './entities/task-repository-link.entity';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { GitHubApiService } from './services/github-api.service';
import { GitHubOAuthService } from './services/github-oauth.service';
import { GitHubService } from './services/github.service';
import { GitHubWebhookRoutingService } from './services/github-webhook-routing.service';
import { GitHubWebhookDeliveryService } from './services/github-webhook-delivery.service';
import { GitHubWebhookPushService } from './services/github-webhook-push.service';
import { GitHubSyncService } from './services/github-sync.service';

@Module({
  imports: [
    WorkspacesModule,
    UsersModule,
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
  controllers: [GitHubWebhookController, GitHubController, WorkspaceGitHubController],
  providers: [GitHubWebhookPushService, GitHubWebhookDeliveryService, GitHubWebhookRoutingService, GitHubService, GitHubApiService, GitHubOAuthService, GitHubSyncService],
  exports: [GitHubService],
})
export class GitHubModule {}

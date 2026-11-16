import { UsersModule } from '../users/users.module';
import { ActivitiesModule } from '../activities/activities.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GitHubController } from './controllers/github.controller';
import { WorkspaceGitHubController } from './controllers/workspace-github.controller';
import { GitHubAccount } from './entities/github-account.entity';
import { GitHubInstallation } from './entities/github-installation.entity';
import { Repository } from './entities/repository.entity';
import { RepositoryCommit } from './entities/repository-commit.entity';
import { RepositoryEntry } from './entities/repository-entry.entity';
import { TaskRepositoryLink } from './entities/task-repository-link.entity';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { GitHubApiService } from './services/github-api.service';
import { GitHubOAuthService } from './services/github-oauth.service';
import { GitHubTokenCryptoService } from './services/github-token-crypto.service';
import { GitHubService } from './services/github.service';
import { GitHubSyncService } from './services/github-sync.service';

@Module({
  imports: [
    WorkspacesModule,
    UsersModule,
    ActivitiesModule,
    TypeOrmModule.forFeature([
      GitHubAccount,
      GitHubInstallation,
      Repository,
      RepositoryCommit,
      RepositoryEntry,
      TaskRepositoryLink,
    ]),
  ],
  controllers: [GitHubController, WorkspaceGitHubController],
  providers: [
    GitHubTokenCryptoService,
    GitHubService,
    GitHubApiService,
    GitHubOAuthService,
    GitHubSyncService,
  ],
  exports: [GitHubService],
})
export class GitHubModule {}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { ConnectRepositoryDto } from '../dto/connect-repository.dto';
import { ConnectedRepositoryResponseDto } from '../dto/connected-repository-response.dto';
import type {
  PublicGitHubBranch,
  PublicGitHubPullRequest,
} from '../services/github-api.service';
import { GitHubService } from '../services/github.service';
import { GitHubSyncService } from '../services/github-sync.service';
import type { GitHubSyncResult } from '../services/github-sync.service';

type AuthenticatedRequest = Request & {
  user: UserResponseDto;
};

@Controller('workspaces/:workspaceId/github')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkspaceGitHubController {
  constructor(
    private readonly githubService: GitHubService,
    private readonly githubSyncService: GitHubSyncService,
  ) {}

  @Post('repository')
  connectRepository(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: ConnectRepositoryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ConnectedRepositoryResponseDto> {
    return this.githubService.connectPublicRepository(
      workspaceId,
      request.user.id,
      dto.setupSessionId,
      dto.githubRepositoryId,
    );
  }

  @Post('sync')
  syncRepository(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<GitHubSyncResult> {
    return this.githubSyncService.syncRepository(
      workspaceId,
      request.user.id,
    );
  }


  @Get('branches')
  listBranches(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<PublicGitHubBranch[]> {
    return this.githubService.listWorkspaceBranches(
      workspaceId,
      request.user.id,
    );
  }

  @Get('pull-requests')
  listPullRequests(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<PublicGitHubPullRequest[]> {
    return this.githubService.listWorkspacePullRequests(
      workspaceId,
      request.user.id,
    );
  }

}

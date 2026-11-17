import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { ConnectRepositoryDto } from '../dto/connect-repository.dto';
import { ConnectedRepositoryResponseDto } from '../dto/connected-repository-response.dto';
import type {
  PublicGitHubBranch,
  PublicGitHubContributor,
  PublicGitHubCollaborator,
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

  @Get('repository')
  async getWorkspaceRepository(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const repository = await this.githubService.getWorkspaceRepository(
      workspaceId,
      request.user.id,
    );
    if (!repository) response.status(204);
    return repository;
  }

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

  @Delete('repository')
  disconnectRepository(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.githubService.disconnectRepository(
      workspaceId,
      request.user.id,
    );
  }

  @Post('sync')
  syncRepository(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<GitHubSyncResult> {
    return this.githubSyncService.syncRepository(workspaceId, request.user.id);
  }

  @Get('statistics/commits')
  getDailyCommitStatistics(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.githubService.getDailyCommitStatistics(
      workspaceId,
      request.user.id,
    );
  }

  @Get('commits')
  listWorkspaceCommits(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() request: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.githubService.listWorkspaceCommits(
      workspaceId,
      request.user.id,
      page === undefined ? 1 : Number(page),
      limit === undefined ? 20 : Number(limit),
    );
  }

  @Get('collaborators')
  listCollaborators(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<PublicGitHubCollaborator[]> {
    return this.githubService.listWorkspaceCollaborators(
      workspaceId,
      request.user.id,
    );
  }

  @Get('contributors')
  listContributors(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<PublicGitHubContributor[]> {
    return this.githubService.listWorkspaceContributors(
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
}

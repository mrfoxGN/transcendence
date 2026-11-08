import {
  Body,
  Controller,
  Get,
  Header,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { GitHubService } from '../services/github.service';
import { ListAvailableRepositoriesDto } from '../dto/list-available-repositories.dto';
import type { PublicGitHubRepository } from '../services/github-api.service';
import { GitHubOAuthService } from '../services/github-oauth.service';

type AuthenticatedRequest = Request & {
  user: UserResponseDto;
};

@Controller('github')
export class GitHubController {
  constructor(
    private readonly githubOAuthService: GitHubOAuthService,
    private readonly githubService: GitHubService,
  ) {}

  @Get('connect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  connect(
    @Query('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ authorizationUrl: string }> {
    return this.githubOAuthService.begin(workspaceId, request.user.id);
  }

  @Get('callback')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  callback(@Query('code') code?: string, @Query('state') state?: string) {
    return this.githubOAuthService.complete(code ?? '', state ?? '');
  }

  @Post('available-repositories')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listAvailableRepositories(
    @Body() dto: ListAvailableRepositoriesDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PublicGitHubRepository[]> {
    return this.githubService.listAvailableRepositories(
      dto.workspaceId,
      request.user.id,
      dto.setupSessionId,
    );
  }
}

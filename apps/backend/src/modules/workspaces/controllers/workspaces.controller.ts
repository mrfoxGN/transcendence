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
import type { Request } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { WorkspaceResponseDto } from '../dto/workspace-response.dto';
import { WorkspacesService } from '../services/workspaces.service';

type AuthenticatedRequest = Request & {
  user: UserResponseDto;
};

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
  ) {}

  @Get()
  getMyWorkspaces(
    @Req() request: AuthenticatedRequest,
  ): Promise<WorkspaceResponseDto[]> {
    return this.workspacesService.findAllForUser(
      request.user.id,
    );
  }

  @Get(':id')
  getWorkspace(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<WorkspaceResponseDto> {
    return this.workspacesService.findOneForUser(
      id,
      request.user.id,
    );
  }

  @Post()
  createWorkspace(
    @Body() dto: CreateWorkspaceDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<WorkspaceResponseDto> {
    return this.workspacesService.create(
      request.user.id,
      dto,
    );
  }
}

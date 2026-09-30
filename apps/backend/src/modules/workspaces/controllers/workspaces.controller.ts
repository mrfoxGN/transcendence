import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import { WorkspaceMemberResponseDto } from '../dto/workspace-member-response.dto';
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

  @Get(':id/members')
  getWorkspaceMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<WorkspaceMemberResponseDto[]> {
    return this.workspacesService.findMembers(
      id,
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

  @Patch(':id')
  updateWorkspace(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkspaceDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<WorkspaceResponseDto> {
    return this.workspacesService.update(
      id,
      request.user.id,
      dto,
    );
  }

  @Patch(':id/archive')
  archiveWorkspace(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<WorkspaceResponseDto> {
    return this.workspacesService.archive(
      id,
      request.user.id,
    );
  }

  @Patch(':id/unarchive')
  unarchiveWorkspace(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<WorkspaceResponseDto> {
    return this.workspacesService.unarchive(
      id,
      request.user.id,
    );
  }

  @Delete(':id/members/:userId')
  removeWorkspaceMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.workspacesService.removeMember(
      id,
      request.user.id,
      userId,
    );
  }

  @Delete(':id')
  deleteWorkspace(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.workspacesService.softDelete(
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

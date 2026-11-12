import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { UserResponseDto } from '../../users/dto/user-response.dto';
import { MilestoneDto, ProjectDto, TaskProjectDto } from '../dto/project.dto';
import { ProjectsService } from '../services/projects.service';

type AuthenticatedRequest = Request & { user: UserResponseDto };

@Controller('workspaces/:workspaceId/projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Req() request: AuthenticatedRequest) {
    return this.projects.list(workspaceId, request.user.id);
  }

  @Post()
  create(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Req() request: AuthenticatedRequest, @Body() dto: ProjectDto) {
    return this.projects.saveProject(workspaceId, request.user.id, dto);
  }

  @Put('task-links/:taskId')
  @HttpCode(204)
  linkTask(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Param('taskId', ParseUUIDPipe) taskId: string,
    @Req() request: AuthenticatedRequest, @Body() dto: TaskProjectDto,
  ) {
    return this.projects.linkTask(workspaceId, request.user.id, taskId, dto);
  }

  @Put(':projectId')
  update(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() request: AuthenticatedRequest, @Body() dto: ProjectDto,
  ) {
    return this.projects.saveProject(workspaceId, request.user.id, dto, projectId);
  }

  @Delete(':projectId')
  @HttpCode(204)
  remove(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projects.removeProject(workspaceId, request.user.id, projectId);
  }

  @Post(':projectId/milestones')
  addMilestone(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() request: AuthenticatedRequest, @Body() dto: MilestoneDto,
  ) {
    return this.projects.saveMilestone(workspaceId, request.user.id, projectId, dto);
  }

  @Put(':projectId/milestones/:milestoneId')
  updateMilestone(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string, @Req() request: AuthenticatedRequest, @Body() dto: MilestoneDto,
  ) {
    return this.projects.saveMilestone(workspaceId, request.user.id, projectId, dto, milestoneId);
  }

  @Delete(':projectId/milestones/:milestoneId')
  @HttpCode(204)
  removeMilestone(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string, @Req() request: AuthenticatedRequest,
  ) {
    return this.projects.removeMilestone(workspaceId, request.user.id, projectId, milestoneId);
  }
}

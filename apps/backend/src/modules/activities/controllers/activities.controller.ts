import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WorkspacesService } from '../../workspaces/services/workspaces.service';
import { ActivityResponseDto } from '../dto/activity-response.dto';
import { ListActivitiesDto } from '../dto/list-activities.dto';
import { ActivitiesService } from '../services/activities.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@Controller('workspaces/:workspaceId/activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  @Get()
  async findAll(
    @Param('workspaceId', ParseUUIDPipe)
    workspaceId: string,
    @Req() request: AuthenticatedRequest,
    @Query() query: ListActivitiesDto,
  ): Promise<ActivityResponseDto[]> {
    await this.workspacesService.findOneForUser(workspaceId, request.user.id);

    return this.activitiesService.findAllForWorkspace(workspaceId, query);
  }
}

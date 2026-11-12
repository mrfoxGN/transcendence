import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, Matches } from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TaskAnalyticsService } from '../services/task-analytics.service';

class AnalyticsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsIn([7, 30])
  days = 30;

  @IsOptional()
  @Matches(/^[1-9]\d{3}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  day?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  asOf?: string;
}

@Controller('workspaces/:workspaceId/analytics')
@UseGuards(JwtAuthGuard)
export class TaskAnalyticsController {
  constructor(private readonly analytics: TaskAnalyticsService) {}

  @Get()
  report(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() request: Request & { user: { id: string } },
    @Query() query: AnalyticsQuery,
  ) {
    return this.analytics.report(workspaceId, request.user.id, query.days, query.day, query.asOf);
  }
}

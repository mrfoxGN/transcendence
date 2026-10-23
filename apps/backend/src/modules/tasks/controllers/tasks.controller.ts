import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { AssignTaskDto } from '../dto/assign-task.dto';
import { CreateTaskCommentDto } from '../dto/create-task-comment.dto';
import { CreateTaskDto } from '../dto/create-task.dto';
import { TaskAssignmentResponseDto } from '../dto/task-assignment-response.dto';
import { TaskBoardResponseDto } from '../dto/task-board-response.dto';
import { TaskCommentResponseDto } from '../dto/task-comment-response.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { TransitionTaskDto } from '../dto/transition-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { TasksService } from '../services/tasks.service';
import { CreateTaskDependencyDto } from '../dto/create-task-dependency.dto';
import { TaskDependencyResponseDto } from '../dto/task-dependency-response.dto';
import { BlockTaskDto } from '../dto/block-task.dto';

type AuthenticatedRequest = Request & {
  user: UserResponseDto;
};

@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('workspaces/:workspaceId/tasks')
  create(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateTaskDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskResponseDto> {
    return this.tasksService.create(workspaceId, request.user.id, dto);
  }

  @Get('workspaces/:workspaceId/board')
  getBoard(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskBoardResponseDto> {
    return this.tasksService.getBoard(workspaceId, request.user.id);
  }

  @Get('tasks/:id')
  findById(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskResponseDto> {
    return this.tasksService.findById(taskId, request.user.id);
  }

  @Patch('tasks/:id')
  update(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskResponseDto> {
    return this.tasksService.update(taskId, request.user.id, dto);
  }

  @Post('tasks/:id/transition')
  transition(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Body() dto: TransitionTaskDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskResponseDto> {
    return this.tasksService.transition(taskId, request.user.id, dto);
  }

  @Delete('tasks/:id')
  @HttpCode(204)
  remove(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.tasksService.remove(taskId, request.user.id);
  }

  @Get('tasks/:id/assignment')
  getAssignment(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskAssignmentResponseDto | null> {
    return this.tasksService.getAssignment(taskId, request.user.id);
  }

  @Post('tasks/:id/assignment')
  assign(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Body() dto: AssignTaskDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskAssignmentResponseDto> {
    return this.tasksService.assign(taskId, request.user.id, dto);
  }

  @Delete('tasks/:id/assignment')
  @HttpCode(204)
  unassign(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.tasksService.unassign(taskId, request.user.id);
  }

  @Post('tasks/:id/comments')
  addComment(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateTaskCommentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskCommentResponseDto> {
    return this.tasksService.addComment(taskId, request.user.id, dto);
  }

  @Get('tasks/:id/comments')
  listComments(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskCommentResponseDto[]> {
    return this.tasksService.listComments(taskId, request.user.id);
  }

  @Patch('tasks/:taskId/comments/:commentId')
  updateComment(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: CreateTaskCommentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskCommentResponseDto> {
    return this.tasksService.updateComment(
      taskId,
      commentId,
      request.user.id,
      dto,
    );
  }

  @Delete('tasks/:taskId/comments/:commentId')
  @HttpCode(204)
  removeComment(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.tasksService.removeComment(taskId, commentId, request.user.id);
  }
  @Post('tasks/:id/dependencies')
  addDependency(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateTaskDependencyDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskDependencyResponseDto> {
    return this.tasksService.addDependency(taskId, request.user.id, dto);
  }

  @Get('tasks/:id/dependencies')
  listDependencies(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskDependencyResponseDto[]> {
    return this.tasksService.listDependencies(taskId, request.user.id);
  }

  @Delete('tasks/:id/dependencies/:dependencyId')
  @HttpCode(204)
  removeDependency(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Param('dependencyId', ParseUUIDPipe) dependencyId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.tasksService.removeDependency(
      taskId,
      request.user.id,
      dependencyId,
    );
  }

  @Post('tasks/:id/block')
  @HttpCode(200)
  block(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Body() dto: BlockTaskDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskResponseDto> {
    return this.tasksService.block(taskId, request.user.id, dto);
  }

  @Delete('tasks/:id/block')
  @HttpCode(200)
  unblock(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskResponseDto> {
    return this.tasksService.unblock(taskId, request.user.id);
  }
}

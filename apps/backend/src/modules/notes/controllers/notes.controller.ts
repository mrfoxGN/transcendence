import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
  Patch,
  Delete,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { CreateNoteDto } from '../dto/create-note.dto';
import { ListNotesDto } from '../dto/list-notes.dto';
import { NoteResponseDto } from '../dto/note-response.dto';
import { NotesService } from '../services/notes.service';
import { NoteRevisionDto, UpdateNoteDto } from '../dto/update-note.dto';

type AuthenticatedRequest = Request & {
  user: UserResponseDto;
};

@Controller('workspaces/:workspaceId/notes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  create(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateNoteDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<NoteResponseDto> {
    return this.notesService.create(workspaceId, request.user.id, dto);
  }

  @Get()
  findAll(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query() query: ListNotesDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<NoteResponseDto[]> {
    return this.notesService.findAll(workspaceId, request.user.id, query);
  }

  @Get(':noteId')
  findOne(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<NoteResponseDto> {
    return this.notesService.findOne(workspaceId, noteId, request.user.id);
  }
  @Patch(':noteId')
  update(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateNoteDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<NoteResponseDto> {
    return this.notesService.update(workspaceId, noteId, request.user.id, dto);
  }

  @Delete(':noteId')
  @HttpCode(204)
  remove(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.notesService.remove(workspaceId, noteId, request.user.id);
  }

  @Get(':noteId/revisions')
  listRevisions(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Req() request: AuthenticatedRequest,
    @Query() query: ListNotesDto,
  ) {
    return this.notesService.listRevisions(workspaceId, noteId, request.user.id, query);
  }

  @Post(':noteId/revisions/:revision/restore')
  @HttpCode(200)
  restoreRevision(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Param('revision', ParseIntPipe) revision: number,
    @Req() request: AuthenticatedRequest,
    @Body() dto: NoteRevisionDto,
  ) {
    return this.notesService.restoreRevision(workspaceId, noteId, request.user.id, revision, dto.revision);
  }

  @Get(':noteId/revisions/:revision')
  findRevision(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Param('revision', ParseIntPipe) revision: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notesService.findRevision(workspaceId, noteId, request.user.id, revision);
  }
}

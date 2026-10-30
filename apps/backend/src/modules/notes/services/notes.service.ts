import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';

import { WorkspacesService } from '../../workspaces/services/workspaces.service';
import { CreateNoteDto } from '../dto/create-note.dto';
import { ListNotesDto } from '../dto/list-notes.dto';
import { NoteResponseDto } from '../dto/note-response.dto';
import { Note } from '../entities/note.entity';
import { NoteMapper } from '../mappers/note.mapper';
import { UpdateNoteDto } from '../dto/update-note.dto';

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note)
    private readonly notesRepository: Repository<Note>,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateNoteDto,
  ): Promise<NoteResponseDto> {
    await this.workspacesService.findOneForUser(workspaceId, userId);

    const title = dto.title.trim();

    if (!title) {
      throw new BadRequestException('Note title is required');
    }

    const now = new Date();

    const note = this.notesRepository.create({
      id: randomUUID(),
      workspaceId,
      creatorId: userId,
      title,
      content: dto.content ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    const savedNote = await this.notesRepository.save(note);

    return NoteMapper.toResponse(savedNote);
  }

  async findAll(
    workspaceId: string,
    userId: string,
    query: ListNotesDto,
  ): Promise<NoteResponseDto[]> {
    await this.workspacesService.findOneForUser(workspaceId, userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const notes = await this.notesRepository.find({
      where: {
        workspaceId,
        deletedAt: IsNull(),
      },
      order: {
        updatedAt: 'DESC',
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return notes.map((note) => NoteMapper.toResponse(note));
  }

  async findOne(
    workspaceId: string,
    noteId: string,
    userId: string,
  ): Promise<NoteResponseDto> {
    await this.workspacesService.findOneForUser(workspaceId, userId);

    const note = await this.notesRepository.findOne({
      where: {
        id: noteId,
        workspaceId,
        deletedAt: IsNull(),
      },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    return NoteMapper.toResponse(note);
  }

  async update(
    workspaceId: string,
    noteId: string,
    userId: string,
    dto: UpdateNoteDto,
  ): Promise<NoteResponseDto> {
    if (dto.title === undefined && dto.content === undefined) {
      throw new BadRequestException('No changes provided');
    }

    const workspace = await this.workspacesService.findOneForUser(
      workspaceId,
      userId,
    );

    const note = await this.notesRepository.findOne({
      where: { id: noteId, workspaceId, deletedAt: IsNull() },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    if (note.creatorId !== userId && workspace.ownerId !== userId) {
      throw new ForbiddenException();
    }

    const changes: Partial<Note> = {
      updatedAt: new Date(),
    };

    if (dto.title !== undefined) {
      const title = dto.title.trim();

      if (!title) {
        throw new BadRequestException('Note title is required');
      }

      changes.title = title;
    }

    if (dto.content !== undefined) {
      changes.content = dto.content;
    }

    const result = await this.notesRepository.update(
      { id: noteId, workspaceId, deletedAt: IsNull() },
      changes,
    );

    if (!result.affected) {
      throw new NotFoundException('Note not found');
    }

    const updatedNote = await this.notesRepository.findOne({
      where: { id: noteId, workspaceId, deletedAt: IsNull() },
    });

    if (!updatedNote) {
      throw new NotFoundException('Note not found');
    }

    return NoteMapper.toResponse(updatedNote);
  }

  async remove(
    workspaceId: string,
    noteId: string,
    userId: string,
  ): Promise<void> {
    const workspace = await this.workspacesService.findOneForUser(
      workspaceId,
      userId,
    );

    const note = await this.notesRepository.findOne({
      where: { id: noteId, workspaceId, deletedAt: IsNull() },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    if (note.creatorId !== userId && workspace.ownerId !== userId) {
      throw new ForbiddenException();
    }

    const result = await this.notesRepository.update(
      { id: noteId, workspaceId, deletedAt: IsNull() },
      { deletedAt: new Date() },
    );

    if (!result.affected) {
      throw new NotFoundException('Note not found');
    }
  }
}
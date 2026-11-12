import { assertWorkspaceWritable } from '../../workspaces/workspace-policy';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { IsNull, Raw, Repository, type EntityManager } from 'typeorm';

import { WorkspacesService } from '../../workspaces/services/workspaces.service';
import { CreateNoteDto } from '../dto/create-note.dto';
import { ListNotesDto } from '../dto/list-notes.dto';
import { NoteResponseDto } from '../dto/note-response.dto';
import { Note } from '../entities/note.entity';
import { NoteMapper } from '../mappers/note.mapper';
import { UpdateNoteDto } from '../dto/update-note.dto';

type Revision = { revision: number; title: string; savedAt: Date };

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
    assertWorkspaceWritable(await this.workspacesService.findOneForUser(workspaceId, userId));

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
      revision: 1,
      pinnedAt: null,
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

    const search = query.search?.trim().replace(/[!%_]/g, character => '!' + character);
    const scope = { workspaceId, deletedAt: IsNull() };
    const contains = Raw<string>(column => `${column} LIKE :search ESCAPE '!'`, { search: '%' + search + '%' });
    const notes = await this.notesRepository.find({
      where: search ? [{ ...scope, title: contains }, { ...scope, content: contains }] : scope,
      order: {
        pinnedAt: 'DESC',
        ...(query.sort === 'name' && { title: 'ASC' as const }),
        updatedAt: 'DESC',
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit + (query.lookahead === '1' ? 1 : 0),
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
    if (dto.title === undefined && dto.content === undefined && dto.pinned === undefined) {
      throw new BadRequestException('No changes provided');
    }
    if (dto.title !== undefined) {
      if (!dto.title.trim()) throw new BadRequestException('Note title is required');
    }
    return this.change(workspaceId, noteId, userId, dto.revision, async (_manager, note) => ({
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.content !== undefined && { content: dto.content }),
      ...(dto.pinned !== undefined && { pinnedAt: dto.pinned ? note.pinnedAt ?? new Date() : null }),
    }));
  }

  async listRevisions(workspaceId: string, noteId: string, userId: string, query: ListNotesDto) {
    await this.findOne(workspaceId, noteId, userId);
    const limit = query.limit ?? 20;
    return this.notesRepository.manager.query<Revision[]>(`
      SELECT revision, title, saved_at AS savedAt FROM note_revisions
      WHERE note_id = ? ORDER BY revision DESC LIMIT ? OFFSET ?`,
    [noteId, limit + (query.lookahead === '1' ? 1 : 0), ((query.page ?? 1) - 1) * limit]);
  }

  async findRevision(workspaceId: string, noteId: string, userId: string, revision: number) {
    await this.findOne(workspaceId, noteId, userId);
    const [snapshot] = await this.notesRepository.manager.query<(Revision & { content: string | null })[]>(
      'SELECT revision, title, content, saved_at AS savedAt FROM note_revisions WHERE note_id = ? AND revision = ?', [noteId, revision],
    );
    if (!snapshot) throw new NotFoundException('Note revision not found');
    return snapshot;
  }

  restoreRevision(workspaceId: string, noteId: string, userId: string, revision: number, expectedRevision: number) {
    return this.change(workspaceId, noteId, userId, expectedRevision, async manager => {
      const [snapshot] = await manager.query<Pick<Note, 'title' | 'content'>[]>(
        'SELECT title, content FROM note_revisions WHERE note_id = ? AND revision = ?', [noteId, revision],
      );
      if (!snapshot) throw new NotFoundException('Note revision not found');
      return snapshot;
    });
  }

  private async change(
    workspaceId: string, noteId: string, userId: string, revision: number,
    getChanges: (manager: EntityManager, note: Note) => Promise<Partial<Note>>,
  ) {
    const workspace = await this.workspacesService.findOneForUser(workspaceId, userId);
    assertWorkspaceWritable(workspace);
    return this.notesRepository.manager.transaction(async manager => {
      const repository = manager.getRepository(Note);
      const where = { id: noteId, workspaceId, deletedAt: IsNull() };
      const note = await repository.findOne({ where, lock: { mode: 'pessimistic_write' } });
      if (!note) throw new NotFoundException('Note not found');
      if (note.creatorId !== userId && workspace.ownerId !== userId) throw new ForbiddenException();
      if (note.revision !== revision) throw new ConflictException('This note changed since you opened it. Load the latest version before saving.');
      const changes = await getChanges(manager, note);
      const contentChanged = (changes.title !== undefined && changes.title !== note.title)
        || (changes.content !== undefined && changes.content !== note.content);
      if (!contentChanged && (changes.pinnedAt === undefined || changes.pinnedAt === note.pinnedAt)) return NoteMapper.toResponse(note);
      if (contentChanged) {
        await manager.query('INSERT INTO note_revisions (note_id, revision, title, content, saved_at) VALUES (?, ?, ?, ?, ?)',
          [note.id, note.revision, note.title, note.content, note.updatedAt]);
        changes.updatedAt = new Date();
      }
      changes.revision = note.revision + 1;
      const result = await repository.update(where, changes);
      if (!result.affected) throw new NotFoundException('Note not found');
      return NoteMapper.toResponse({ ...note, ...changes });
    });
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
    assertWorkspaceWritable(workspace);

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

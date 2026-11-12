import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

jest.mock('../../workspaces/services/workspaces.service', () => ({
  WorkspacesService: class WorkspacesService {},
}));

import type { WorkspacesService } from '../../workspaces/services/workspaces.service';
import { Note } from '../entities/note.entity';
import { NotesService } from './notes.service';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const noteId = '22222222-2222-4222-8222-222222222222';
const creatorId = '33333333-3333-4333-8333-333333333333';
const ownerId = '44444444-4444-4444-8444-444444444444';
const memberId = '55555555-5555-4555-8555-555555555555';
const date = new Date('2026-10-30T12:00:00.000Z');

function makeNote(overrides: Partial<Note> = {}): Note {
  return Object.assign(new Note(), {
    id: noteId,
    workspaceId,
    creatorId,
    title: 'Meeting notes',
    content: 'Discuss the backend',
    createdAt: date,
    updatedAt: date,
    deletedAt: null,
    revision: 1,
    pinnedAt: null,
    ...overrides,
  });
}

function makeRepository() {
  const repository = {
    create: jest.fn((value: object) => value),
    save: jest.fn((value: object) => Promise.resolve(value)),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const manager = {
    getRepository: jest.fn(() => repository),
    query: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue({}),
  };
  return { ...repository, manager: { ...manager, transaction: jest.fn(async callback => callback(manager)) } };
}

describe('NotesService', () => {
  let service: NotesService;
  let repository: ReturnType<typeof makeRepository>;
  let findOneForUser: jest.Mock;

  beforeEach(() => {
    repository = makeRepository();
    findOneForUser = jest.fn().mockResolvedValue({ ownerId });

    service = new NotesService(
      repository as unknown as Repository<Note>,
      {
        findOneForUser,
      } as unknown as WorkspacesService,
      { create: jest.fn().mockResolvedValue({}) } as never,
    );
  });

  it('creates a note with a trimmed title and safe response', async () => {
    const result = await service.create(workspaceId, creatorId, {
      title: '  Meeting notes  ',
      content: 'Discuss the backend',
    });

    expect(findOneForUser).toHaveBeenCalledWith(workspaceId, creatorId);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        creatorId,
        title: 'Meeting notes',
        content: 'Discuss the backend',
        deletedAt: null,
      }),
    );
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(result.title).toBe('Meeting notes');
    expect(result).not.toHaveProperty('deletedAt');
  });

  it('rejects a blank title', async () => {
    await expect(
      service.create(workspaceId, creatorId, { title: '   ' }),
    ).rejects.toThrow(BadRequestException);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('does not create a note when workspace access fails', async () => {
    findOneForUser.mockRejectedValue(new ForbiddenException());

    await expect(
      service.create(workspaceId, memberId, { title: 'Secret' }),
    ).rejects.toThrow(ForbiddenException);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('lists only notes in the workspace with pagination', async () => {
    repository.find.mockResolvedValue([makeNote()]);

    const result = await service.findAll(workspaceId, creatorId, {
      page: 2,
      limit: 5,
    });

    expect(repository.find).toHaveBeenCalledWith({
      where: {
        workspaceId,
        deletedAt: expect.anything() as unknown,
      },
      order: {
        pinnedAt: 'DESC',
        updatedAt: 'DESC',
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip: 5,
      take: 5,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(noteId);
    expect(result[0]).not.toHaveProperty('deletedAt');
  });

  it('uses default pagination', async () => {
    await service.findAll(workspaceId, creatorId, {});

    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it('searches note titles and content and sorts before paging', async () => {
    await service.findAll(workspaceId, creatorId, {
      page: 2,
      search: 'sprint_2',
      sort: 'name',
      lookahead: '1',
    });

    const options = repository.find.mock.calls[0][0];
    expect(options.where.every((scope: { workspaceId: string }) => scope.workspaceId === workspaceId)).toBe(true);
    expect(options.where[0].title.objectLiteralParameters).toEqual({
      search: '%sprint!_2%',
    });
    expect(options.where[1].content.objectLiteralParameters).toEqual({ search: '%sprint!_2%' });
    expect(options.order).toEqual({
      pinnedAt: 'DESC',
      title: 'ASC',
      updatedAt: 'DESC',
      createdAt: 'DESC',
      id: 'DESC',
    });
    expect(options.skip).toBe(20);
    expect(options.take).toBe(21);
  });

  it('finds one note in the requested workspace', async () => {
    repository.findOne.mockResolvedValue(makeNote());

    const result = await service.findOne(workspaceId, noteId, creatorId);

    expect(repository.findOne).toHaveBeenCalledWith({
      where: {
        id: noteId,
        workspaceId,
        deletedAt: expect.anything() as unknown,
      },
    });
    expect(result.id).toBe(noteId);
  });

  it('returns 404 when the note is missing', async () => {
    await expect(
      service.findOne(workspaceId, noteId, creatorId),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects an empty update', async () => {
    await expect(
      service.update(workspaceId, noteId, creatorId, { revision: 1 }),
    ).rejects.toThrow(BadRequestException);

    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects an update by a member who is not creator or owner', async () => {
    repository.findOne.mockResolvedValue(makeNote());

    await expect(
      service.update(workspaceId, noteId, memberId, {
        revision: 1,
        title: 'Changed',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(repository.update).not.toHaveBeenCalled();
  });

  it('lets the creator update the title', async () => {
    repository.findOne
      .mockResolvedValueOnce(makeNote())
      .mockResolvedValueOnce(makeNote({ title: 'Changed' }));

    const result = await service.update(workspaceId, noteId, creatorId, {
      revision: 1,
      title: '  Changed  ',
    });

    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: noteId, workspaceId }),
      expect.objectContaining({ title: 'Changed' }),
    );
    expect(result.title).toBe('Changed');
    expect(result.revision).toBe(2);
    expect(repository.manager.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO note_revisions'),
      [noteId, 1, 'Meeting notes', 'Discuss the backend', date]);
  });

  it('lets the workspace owner clear the content', async () => {
    repository.findOne
      .mockResolvedValueOnce(makeNote())
      .mockResolvedValueOnce(makeNote({ content: null }));

    const result = await service.update(workspaceId, noteId, ownerId, {
      revision: 1,
      content: null,
    });

    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: noteId, workspaceId }),
      expect.objectContaining({ content: null }),
    );
    expect(result.content).toBeNull();
  });

  it('returns 404 if the note disappears during update', async () => {
    repository.findOne.mockResolvedValue(makeNote());
    repository.update.mockResolvedValue({ affected: 0 });

    await expect(
      service.update(workspaceId, noteId, creatorId, {
        revision: 1,
        title: 'Changed',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a stale editor before writing a revision or overwriting the note', async () => {
    repository.findOne.mockResolvedValue(makeNote({ revision: 2 }));
    await expect(service.update(workspaceId, noteId, creatorId, { revision: 1, content: 'Stale draft' }))
      .rejects.toThrow(ConflictException);
    expect(repository.manager.query).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('restores a snapshot as a new revision and leaves the pin intact', async () => {
    repository.findOne.mockResolvedValue(makeNote({ revision: 3, pinnedAt: date }));
    repository.manager.query.mockResolvedValueOnce([{ title: 'Original', content: 'Original text' }]);
    const result = await service.restoreRevision(workspaceId, noteId, ownerId, 1, 3);
    expect(result).toMatchObject({ title: 'Original', content: 'Original text', revision: 4, pinnedAt: date });
    expect(repository.manager.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO note_revisions'),
      [noteId, 3, 'Meeting notes', 'Discuss the backend', date]);
  });

  it('soft deletes a note for its creator', async () => {
    repository.findOne.mockResolvedValue(makeNote());

    await service.remove(workspaceId, noteId, creatorId);

    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: noteId, workspaceId }),
      { deletedAt: expect.any(Date) as unknown },
    );
  });

  it('rejects deletion by a member who is not creator or owner', async () => {
    repository.findOne.mockResolvedValue(makeNote());

    await expect(service.remove(workspaceId, noteId, memberId)).rejects.toThrow(
      ForbiddenException,
    );

    expect(repository.update).not.toHaveBeenCalled();
  });

  it('returns 404 when deleting a missing note', async () => {
    await expect(
      service.remove(workspaceId, noteId, creatorId),
    ).rejects.toThrow(NotFoundException);
  });
});

// These tests check what the controller passes to the service.
// They do not start the HTTP server or connect to MySQL.
jest.mock('../../auth/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class JwtAuthGuard {},
}));

jest.mock('../services/notes.service', () => ({
  NotesService: class NotesService {},
}));

import type { NotesService } from '../services/notes.service';
import { NotesController } from './notes.controller';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const noteId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';

describe('NotesController', () => {
  const create = jest.fn();
  const findAll = jest.fn();
  const findOne = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();

  const controller = new NotesController({
    create,
    findAll,
    findOne,
    update,
    remove,
  } as unknown as NotesService);

  const request = {
    user: { id: userId },
  } as Parameters<NotesController['create']>[2];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes create input and the authenticated user to the service', async () => {
    const dto = { title: 'Meeting notes', content: 'Hello' };
    const response = { id: noteId, title: dto.title };
    create.mockResolvedValue(response);

    await expect(controller.create(workspaceId, dto, request)).resolves.toBe(
      response,
    );

    expect(create).toHaveBeenCalledWith(workspaceId, userId, dto);
  });

  it('passes list pagination and the authenticated user to the service', async () => {
    const query = { page: 2, limit: 5 };
    findAll.mockResolvedValue([]);

    await expect(
      controller.findAll(workspaceId, query, request),
    ).resolves.toEqual([]);

    expect(findAll).toHaveBeenCalledWith(workspaceId, userId, query);
  });

  it('passes both IDs to findOne', async () => {
    const response = { id: noteId };
    findOne.mockResolvedValue(response);

    await expect(
      controller.findOne(workspaceId, noteId, request),
    ).resolves.toBe(response);

    expect(findOne).toHaveBeenCalledWith(workspaceId, noteId, userId);
  });

  it('passes update data and the authenticated user to the service', async () => {
    const dto = { title: 'Updated notes' };
    const response = { id: noteId, title: dto.title };
    update.mockResolvedValue(response);

    await expect(
      controller.update(workspaceId, noteId, dto, request),
    ).resolves.toBe(response);

    expect(update).toHaveBeenCalledWith(workspaceId, noteId, userId, dto);
  });

  it('passes both IDs and the authenticated user to remove', async () => {
    remove.mockResolvedValue(undefined);

    await expect(
      controller.remove(workspaceId, noteId, request),
    ).resolves.toBeUndefined();

    expect(remove).toHaveBeenCalledWith(workspaceId, noteId, userId);
  });
});

import { DataSource, EntityManager } from 'typeorm';

import { WorkspaceKanbanSetting } from '../entities/workspace-kanban-setting.entity';
import { WorkspaceMembership } from '../entities/workspace-membership.entity';
import { Workspace } from '../entities/workspace.entity';
import { WorkspacesService } from './workspaces.service';

describe('WorkspacesService', () => {
  const ownerId = '1897c53b-478a-414d-b332-ae6db9d6d6da';

  it('creates a workspace, owner membership and default kanban settings', async () => {
    const manager = {
      create: jest.fn((_entity, data) => data),
      save: jest.fn(async (entity) => entity),
    } as unknown as EntityManager;

    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    const response = await service.create(ownerId, {
      name: 'Transcendence Team',
      description: 'Main workspace',
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);

    expect(manager.create).toHaveBeenNthCalledWith(
      1,
      Workspace,
      expect.objectContaining({
        ownerId,
        name: 'Transcendence Team',
        description: 'Main workspace',
        archivedAt: null,
        deletedAt: null,
      }),
    );

    expect(manager.create).toHaveBeenNthCalledWith(
      2,
      WorkspaceMembership,
      expect.objectContaining({
        userId: ownerId,
      }),
    );

    expect(manager.create).toHaveBeenNthCalledWith(
      3,
      WorkspaceKanbanSetting,
      expect.objectContaining({
        activeWipLimit: 3,
        definitionOfReady: null,
        definitionOfDone: null,
      }),
    );

    expect(manager.save).toHaveBeenCalledTimes(3);

    expect(response).toEqual(
      expect.objectContaining({
        ownerId,
        name: 'Transcendence Team',
        description: 'Main workspace',
        archivedAt: null,
      }),
    );

    expect(response).not.toHaveProperty('deletedAt');
  });

  it('stores a missing description as null', async () => {
    const manager = {
      create: jest.fn((_entity, data) => data),
      save: jest.fn(async (entity) => entity),
    } as unknown as EntityManager;

    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    const response = await service.create(ownerId, {
      name: 'Workspace Without Description',
    });

    expect(manager.create).toHaveBeenNthCalledWith(
      1,
      Workspace,
      expect.objectContaining({
        description: null,
      }),
    );

    expect(response.description).toBeNull();
  });

  it('propagates an error when one transaction operation fails', async () => {
    const manager = {
      create: jest.fn((_entity, data) => data),
      save: jest
        .fn()
        .mockImplementationOnce(async (entity) => entity)
        .mockRejectedValueOnce(new Error('Membership creation failed')),
    } as unknown as EntityManager;

    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    await expect(
      service.create(ownerId, {
        name: 'Broken Workspace',
      }),
    ).rejects.toThrow('Membership creation failed');

    expect(manager.save).toHaveBeenCalledTimes(2);
  });
});

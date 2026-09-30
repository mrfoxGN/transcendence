import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { WorkspaceKanbanSetting } from '../entities/workspace-kanban-setting.entity';
import { WorkspaceMembership } from '../entities/workspace-membership.entity';
import { Workspace } from '../entities/workspace.entity';
import { WorkspacesService } from './workspaces.service';

describe('WorkspacesService', () => {
  const ownerId = '1897c53b-478a-414d-b332-ae6db9d6d6da';
  const workspaceId = '4eb53fcb-011b-4f42-b4c3-6f5d5fd62b64';

  function makeWorkspace(): Workspace {
    return {
      id: workspaceId,
      ownerId,
      name: 'Transcendence Team',
      description: 'Main workspace',
      createdAt: new Date('2026-09-26T13:31:56.955Z'),
      updatedAt: new Date('2026-09-26T13:31:56.955Z'),
      archivedAt: null,
      deletedAt: null,
    } as Workspace;
  }

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

  it('lists only workspaces belonging to the user memberships', async () => {
    const workspace = makeWorkspace();

    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([workspace]),
    };

    const workspaceRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(workspaceRepository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    const result = await service.findAllForUser(ownerId);

    expect(dataSource.getRepository).toHaveBeenCalledWith(Workspace);

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'membership.userId = :userId',
      { userId: ownerId },
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'workspace.deletedAt IS NULL',
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(workspaceId);
    expect(result[0]).not.toHaveProperty('deletedAt');
  });

  it('returns one workspace when the user is a member', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const membershipRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'membership-id',
        workspaceId,
        userId: ownerId,
      }),
    };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === Workspace) {
          return workspaceRepository;
        }

        if (entity === WorkspaceMembership) {
          return membershipRepository;
        }

        throw new Error('Unexpected repository');
      }),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    const result = await service.findOneForUser(
      workspaceId,
      ownerId,
    );

    expect(result.id).toBe(workspaceId);
    expect(result.ownerId).toBe(ownerId);
    expect(result).not.toHaveProperty('deletedAt');

    expect(membershipRepository.findOne).toHaveBeenCalledWith({
      where: {
        workspaceId,
        userId: ownerId,
      },
    });
  });

  it('returns 404 when the workspace does not exist', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(workspaceRepository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    await expect(
      service.findOneForUser(workspaceId, ownerId),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 403 when the user is not a workspace member', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const membershipRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === Workspace) {
          return workspaceRepository;
        }

        if (entity === WorkspaceMembership) {
          return membershipRepository;
        }

        throw new Error('Unexpected repository');
      }),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    await expect(
      service.findOneForUser(workspaceId, ownerId),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('WorkspacesService update', () => {
  const ownerId = '1897c53b-478a-414d-b332-ae6db9d6d6da';
  const otherUserId = '2897c53b-478a-414d-b332-ae6db9d6d6da';
  const workspaceId = '4eb53fcb-011b-4f42-b4c3-6f5d5fd62b64';

  function makeWorkspace(): Workspace {
    return {
      id: workspaceId,
      ownerId,
      name: 'Old Name',
      description: 'Old description',
      createdAt: new Date('2026-09-26T13:00:00Z'),
      updatedAt: new Date('2026-09-26T13:00:00Z'),
      archivedAt: null,
      deletedAt: null,
    } as Workspace;
  }

  it('allows the owner to update workspace fields', async () => {
    const workspace = makeWorkspace();

    const repository = {
      findOne: jest.fn().mockResolvedValue(workspace),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    const response = await service.update(
      workspaceId,
      ownerId,
      {
        name: 'Updated Name',
        description: 'Updated description',
      },
    );

    expect(workspace.name).toBe('Updated Name');
    expect(workspace.description).toBe('Updated description');
    expect(workspace.updatedAt).toBeInstanceOf(Date);

    expect(repository.save).toHaveBeenCalledWith(workspace);

    expect(response.name).toBe('Updated Name');
    expect(response.description).toBe('Updated description');
    expect(response).not.toHaveProperty('deletedAt');
  });

  it('rejects an empty update', async () => {
    const dataSource = {
      getRepository: jest.fn(),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    await expect(
      service.update(workspaceId, ownerId, {}),
    ).rejects.toThrow(BadRequestException);

    expect(dataSource.getRepository).not.toHaveBeenCalled();
  });

  it('returns 404 when updating a missing workspace', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    await expect(
      service.update(
        workspaceId,
        ownerId,
        { name: 'Updated Name' },
      ),
    ).rejects.toThrow(NotFoundException);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('returns 403 when a non-owner tries to update', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
      save: jest.fn(),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    await expect(
      service.update(
        workspaceId,
        otherUserId,
        { name: 'Unauthorized Name' },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(repository.save).not.toHaveBeenCalled();
  });
});


describe('WorkspacesService archive/unarchive/delete', () => {
  const ownerId = '1897c53b-478a-414d-b332-ae6db9d6d6da';
  const otherUserId = '2897c53b-478a-414d-b332-ae6db9d6d6da';
  const workspaceId = '4eb53fcb-011b-4f42-b4c3-6f5d5fd62b64';

  function makeWorkspace(): Workspace {
    return {
      id: workspaceId,
      ownerId,
      name: 'Transcendence Workspace',
      description: 'Workspace description',
      createdAt: new Date('2026-09-26T13:00:00Z'),
      updatedAt: new Date('2026-09-26T13:00:00Z'),
      archivedAt: null,
      deletedAt: null,
    } as Workspace;
  }

  it('allows the owner to archive a workspace', async () => {
    const workspace = makeWorkspace();

    const repository = {
      findOne: jest.fn().mockResolvedValue(workspace),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    const response = await service.archive(
      workspaceId,
      ownerId,
    );

    expect(workspace.archivedAt).toBeInstanceOf(Date);
    expect(workspace.updatedAt).toBeInstanceOf(Date);
    expect(repository.save).toHaveBeenCalledWith(workspace);
    expect(response.archivedAt).toBeInstanceOf(Date);
  });

  it('returns 404 when archiving a missing workspace', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    await expect(
      service.archive(workspaceId, ownerId),
    ).rejects.toThrow(NotFoundException);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('returns 403 when a non-owner tries to archive', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
      save: jest.fn(),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    await expect(
      service.archive(workspaceId, otherUserId),
    ).rejects.toThrow(ForbiddenException);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('allows the owner to unarchive a workspace', async () => {
    const workspace = makeWorkspace();
    workspace.archivedAt = new Date('2026-09-30T13:00:00Z');

    const repository = {
      findOne: jest.fn().mockResolvedValue(workspace),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    const response = await service.unarchive(
      workspaceId,
      ownerId,
    );

    expect(workspace.archivedAt).toBeNull();
    expect(repository.save).toHaveBeenCalledWith(workspace);
    expect(response.archivedAt).toBeNull();
  });

  it('returns 404 when unarchiving a missing workspace', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    await expect(
      service.unarchive(workspaceId, ownerId),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 403 when a non-owner tries to unarchive', async () => {
    const workspace = makeWorkspace();
    workspace.archivedAt = new Date();

    const repository = {
      findOne: jest.fn().mockResolvedValue(workspace),
      save: jest.fn(),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    await expect(
      service.unarchive(workspaceId, otherUserId),
    ).rejects.toThrow(ForbiddenException);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('soft deletes a workspace without removing the row', async () => {
    const workspace = makeWorkspace();

    const repository = {
      findOne: jest.fn().mockResolvedValue(workspace),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    await service.softDelete(
      workspaceId,
      ownerId,
    );

    expect(workspace.deletedAt).toBeInstanceOf(Date);
    expect(workspace.updatedAt).toBeInstanceOf(Date);
    expect(repository.save).toHaveBeenCalledWith(workspace);
  });

  it('returns 404 when deleting a missing workspace', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    await expect(
      service.softDelete(workspaceId, ownerId),
    ).rejects.toThrow(NotFoundException);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('returns 403 when a non-owner tries to delete', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
      save: jest.fn(),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    await expect(
      service.softDelete(workspaceId, otherUserId),
    ).rejects.toThrow(ForbiddenException);

    expect(repository.save).not.toHaveBeenCalled();
  });
});


describe('WorkspacesService members', () => {
  const userId = '1897c53b-478a-414d-b332-ae6db9d6d6da';
  const workspaceId = '4eb53fcb-011b-4f42-b4c3-6f5d5fd62b64';

  it('returns the members of a workspace', async () => {
    const membershipRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: '12499996-b915-4109-8061-749d82dd5ab0',
          workspaceId,
          userId,
          joinedAt: new Date('2026-09-26T13:31:56.955Z'),
          user: {
            id: userId,
            username: 'anass_test',
            avatarUrl: null,
          },
        },
      ]),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(membershipRepository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    jest.spyOn(service, 'findOneForUser').mockResolvedValue({
      id: workspaceId,
      ownerId: userId,
      name: 'Transcendence Workspace',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
    });

    const result = await service.findMembers(
      workspaceId,
      userId,
    );

    expect(service.findOneForUser).toHaveBeenCalledWith(
      workspaceId,
      userId,
    );

    expect(membershipRepository.find).toHaveBeenCalledWith({
      where: {
        workspaceId,
      },
      relations: {
        user: true,
      },
      order: {
        joinedAt: 'ASC',
      },
    });

    expect(result).toEqual([
      {
        membershipId: '12499996-b915-4109-8061-749d82dd5ab0',
        userId,
        username: 'anass_test',
        avatarUrl: null,
        joinedAt: new Date('2026-09-26T13:31:56.955Z'),
        isOwner: true,
      },
    ]);

    expect(result[0]).not.toHaveProperty('email');
    expect(result[0]).not.toHaveProperty('passwordHash');
  });

  it('marks non-owner members with isOwner false', async () => {
    const ownerId = '2897c53b-478a-414d-b332-ae6db9d6d6da';

    const membershipRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'membership-id',
          workspaceId,
          userId,
          joinedAt: new Date(),
          user: {
            id: userId,
            username: 'member',
            avatarUrl: null,
          },
        },
      ]),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(membershipRepository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    jest.spyOn(service, 'findOneForUser').mockResolvedValue({
      id: workspaceId,
      ownerId,
      name: 'Workspace',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
    });

    const result = await service.findMembers(
      workspaceId,
      userId,
    );

    expect(result[0].isOwner).toBe(false);
  });

  it('does not load memberships when workspace access is rejected', async () => {
    const membershipRepository = {
      find: jest.fn(),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(membershipRepository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    jest.spyOn(service, 'findOneForUser').mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      service.findMembers(workspaceId, userId),
    ).rejects.toThrow(ForbiddenException);

    expect(membershipRepository.find).not.toHaveBeenCalled();
  });
});


describe('WorkspacesService removeMember', () => {
  const ownerId = '1897c53b-478a-414d-b332-ae6db9d6d6da';
  const memberId = 'dfc8ad56-f9c0-4918-9190-31bdba2341fe';
  const workspaceId = '4eb53fcb-011b-4f42-b4c3-6f5d5fd62b64';

  function makeWorkspace(): Workspace {
    return {
      id: workspaceId,
      ownerId,
      name: 'Transcendence Workspace',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
      deletedAt: null,
    } as Workspace;
  }

  it('allows the owner to remove another member', async () => {
    const membership = {
      id: 'membership-id',
      workspaceId,
      userId: memberId,
      joinedAt: new Date(),
    };

    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const membershipRepository = {
      findOne: jest.fn().mockResolvedValue(membership),
      remove: jest.fn().mockResolvedValue(membership),
    };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === Workspace) {
          return workspaceRepository;
        }

        if (entity === WorkspaceMembership) {
          return membershipRepository;
        }

        throw new Error('Unexpected repository');
      }),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    await service.removeMember(
      workspaceId,
      ownerId,
      memberId,
    );

    expect(membershipRepository.findOne).toHaveBeenCalledWith({
      where: {
        workspaceId,
        userId: memberId,
      },
    });

    expect(membershipRepository.remove).toHaveBeenCalledWith(
      membership,
    );
  });

  it('returns 404 when workspace does not exist', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(workspaceRepository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    await expect(
      service.removeMember(
        workspaceId,
        ownerId,
        memberId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 403 when current user is not the owner', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(workspaceRepository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    await expect(
      service.removeMember(
        workspaceId,
        memberId,
        ownerId,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects removing the workspace owner', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(workspaceRepository),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    await expect(
      service.removeMember(
        workspaceId,
        ownerId,
        ownerId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns 404 when target user is not a member', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const membershipRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      remove: jest.fn(),
    };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === Workspace) {
          return workspaceRepository;
        }

        if (entity === WorkspaceMembership) {
          return membershipRepository;
        }

        throw new Error('Unexpected repository');
      }),
    } as unknown as DataSource;

    const service = new WorkspacesService(dataSource);

    await expect(
      service.removeMember(
        workspaceId,
        ownerId,
        memberId,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(membershipRepository.remove).not.toHaveBeenCalled();
  });
});

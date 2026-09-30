import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { InvitationStatus } from '../../../database/enums/database.enums';
import { UsersService } from '../../users/services/users.service';

import { WorkspaceInvitation } from '../entities/workspace-invitation.entity';
import { WorkspaceKanbanSetting } from '../entities/workspace-kanban-setting.entity';
import { WorkspaceMembership } from '../entities/workspace-membership.entity';
import { Workspace } from '../entities/workspace.entity';
import { WorkspacesService } from './workspaces.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

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


describe('WorkspacesService createInvitation', () => {
  const ownerId = '1897c53b-478a-414d-b332-ae6db9d6d6da';
  const invitedUserId = 'dfc8ad56-f9c0-4918-9190-31bdba2341fe';
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

  it('creates a pending invitation for an existing user', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const membershipRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const invitationRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === Workspace) {
          return workspaceRepository;
        }

        if (entity === WorkspaceMembership) {
          return membershipRepository;
        }

        if (entity === WorkspaceInvitation) {
          return invitationRepository;
        }

        throw new Error('Unexpected repository');
      }),
    } as unknown as DataSource;

    const usersService = {
      findById: jest.fn().mockResolvedValue({
        id: invitedUserId,
        username: 'outsider_test',
      }),
    } as unknown as UsersService;

    const service = new WorkspacesService(
      dataSource,
      usersService,
    );

    const response = await service.createInvitation(
      workspaceId,
      ownerId,
      {
        invitedUserId,
      },
    );

    expect(usersService.findById).toHaveBeenCalledWith(
      invitedUserId,
    );

    expect(membershipRepository.findOne).toHaveBeenCalledWith({
      where: {
        workspaceId,
        userId: invitedUserId,
      },
    });

    expect(invitationRepository.findOne).toHaveBeenCalledWith({
      where: {
        workspaceId,
        invitedUserId,
        status: InvitationStatus.PENDING,
      },
    });

    expect(invitationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        invitedById: ownerId,
        invitedUserId,
        invitedEmail: null,
        status: InvitationStatus.PENDING,
        tokenHash: null,
        expiresAt: null,
        respondedAt: null,
      }),
    );

    expect(response.status).toBe(InvitationStatus.PENDING);
    expect(response.invitedUserId).toBe(invitedUserId);
    expect(response.invitedById).toBe(ownerId);
    expect(response).not.toHaveProperty('tokenHash');
  });

  it('returns 404 when workspace does not exist', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(workspaceRepository),
    } as unknown as DataSource;

    const usersService = {
      findById: jest.fn(),
    } as unknown as UsersService;

    const service = new WorkspacesService(
      dataSource,
      usersService,
    );

    await expect(
      service.createInvitation(
        workspaceId,
        ownerId,
        { invitedUserId },
      ),
    ).rejects.toThrow(NotFoundException);

    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('returns 403 when current user is not the workspace owner', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(workspaceRepository),
    } as unknown as DataSource;

    const usersService = {
      findById: jest.fn(),
    } as unknown as UsersService;

    const service = new WorkspacesService(
      dataSource,
      usersService,
    );

    await expect(
      service.createInvitation(
        workspaceId,
        invitedUserId,
        { invitedUserId: ownerId },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('rejects the owner inviting themselves', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(workspaceRepository),
    } as unknown as DataSource;

    const usersService = {
      findById: jest.fn(),
    } as unknown as UsersService;

    const service = new WorkspacesService(
      dataSource,
      usersService,
    );

    await expect(
      service.createInvitation(
        workspaceId,
        ownerId,
        { invitedUserId: ownerId },
      ),
    ).rejects.toThrow(BadRequestException);

    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('returns 404 when the invited user does not exist', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(workspaceRepository),
    } as unknown as DataSource;

    const usersService = {
      findById: jest.fn().mockRejectedValue(
        new NotFoundException('User not found'),
      ),
    } as unknown as UsersService;

    const service = new WorkspacesService(
      dataSource,
      usersService,
    );

    await expect(
      service.createInvitation(
        workspaceId,
        ownerId,
        { invitedUserId },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 409 when the invited user is already a member', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const membershipRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'membership-id',
        workspaceId,
        userId: invitedUserId,
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

    const usersService = {
      findById: jest.fn().mockResolvedValue({
        id: invitedUserId,
      }),
    } as unknown as UsersService;

    const service = new WorkspacesService(
      dataSource,
      usersService,
    );

    await expect(
      service.createInvitation(
        workspaceId,
        ownerId,
        { invitedUserId },
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('returns 409 when a pending invitation already exists', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const membershipRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const invitationRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'existing-invitation',
        workspaceId,
        invitedUserId,
        status: InvitationStatus.PENDING,
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

        if (entity === WorkspaceInvitation) {
          return invitationRepository;
        }

        throw new Error('Unexpected repository');
      }),
    } as unknown as DataSource;

    const usersService = {
      findById: jest.fn().mockResolvedValue({
        id: invitedUserId,
      }),
    } as unknown as UsersService;

    const service = new WorkspacesService(
      dataSource,
      usersService,
    );

    await expect(
      service.createInvitation(
        workspaceId,
        ownerId,
        { invitedUserId },
      ),
    ).rejects.toThrow(ConflictException);
  });
});


describe('WorkspacesService acceptInvitation', () => {
  const ownerId = '1897c53b-478a-414d-b332-ae6db9d6d6da';
  const invitedUserId = 'dfc8ad56-f9c0-4918-9190-31bdba2341fe';
  const workspaceId = '4eb53fcb-011b-4f42-b4c3-6f5d5fd62b64';
  const invitationId = 'a08765d8-d411-4d0b-a47a-77037526aa58';

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

  function makeInvitation(): WorkspaceInvitation {
    return {
      id: invitationId,
      workspaceId,
      invitedById: ownerId,
      invitedUserId,
      invitedEmail: null,
      status: InvitationStatus.PENDING,
      tokenHash: null,
      expiresAt: null,
      respondedAt: null,
      createdAt: new Date(),
    } as WorkspaceInvitation;
  }

  it('accepts a pending invitation and creates membership', async () => {
    const invitation = makeInvitation();

    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const invitationRepository = {
      findOne: jest.fn().mockResolvedValue(invitation),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    const membershipRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Workspace) {
          return workspaceRepository;
        }

        if (entity === WorkspaceInvitation) {
          return invitationRepository;
        }

        if (entity === WorkspaceMembership) {
          return membershipRepository;
        }

        throw new Error('Unexpected repository');
      }),
    };

    const dataSource = {
      transaction: jest.fn(
        async (callback) => callback(manager),
      ),
    } as unknown as DataSource;

    const usersService = {} as UsersService;

    const service = new WorkspacesService(
      dataSource,
      usersService,
    );

    const response = await service.acceptInvitation(
      workspaceId,
      invitationId,
      invitedUserId,
    );

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);

    expect(membershipRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        userId: invitedUserId,
      }),
    );

    expect(membershipRepository.save).toHaveBeenCalledTimes(1);

    expect(invitation.status).toBe(
      InvitationStatus.ACCEPTED,
    );

    expect(invitation.respondedAt).toBeInstanceOf(Date);

    expect(invitationRepository.save).toHaveBeenCalledWith(
      invitation,
    );

    expect(response.status).toBe(
      InvitationStatus.ACCEPTED,
    );

    expect(response.respondedAt).toBeInstanceOf(Date);
  });

  it('returns 404 when workspace does not exist', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const manager = {
      getRepository: jest.fn().mockReturnValue(
        workspaceRepository,
      ),
    };

    const dataSource = {
      transaction: jest.fn(
        async (callback) => callback(manager),
      ),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    await expect(
      service.acceptInvitation(
        workspaceId,
        invitationId,
        invitedUserId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 404 when invitation does not exist', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const invitationRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Workspace) {
          return workspaceRepository;
        }

        if (entity === WorkspaceInvitation) {
          return invitationRepository;
        }

        return {};
      }),
    };

    const dataSource = {
      transaction: jest.fn(
        async (callback) => callback(manager),
      ),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    await expect(
      service.acceptInvitation(
        workspaceId,
        invitationId,
        invitedUserId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 403 when another user tries to accept', async () => {
    const invitation = makeInvitation();

    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const invitationRepository = {
      findOne: jest.fn().mockResolvedValue(invitation),
    };

    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Workspace) {
          return workspaceRepository;
        }

        if (entity === WorkspaceInvitation) {
          return invitationRepository;
        }

        return {};
      }),
    };

    const dataSource = {
      transaction: jest.fn(
        async (callback) => callback(manager),
      ),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    await expect(
      service.acceptInvitation(
        workspaceId,
        invitationId,
        ownerId,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns 409 when invitation is no longer pending', async () => {
    const invitation = makeInvitation();
    invitation.status = InvitationStatus.ACCEPTED;

    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const invitationRepository = {
      findOne: jest.fn().mockResolvedValue(invitation),
    };

    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Workspace) {
          return workspaceRepository;
        }

        if (entity === WorkspaceInvitation) {
          return invitationRepository;
        }

        return {};
      }),
    };

    const dataSource = {
      transaction: jest.fn(
        async (callback) => callback(manager),
      ),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    await expect(
      service.acceptInvitation(
        workspaceId,
        invitationId,
        invitedUserId,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('returns 409 when invited user is already a member', async () => {
    const invitation = makeInvitation();

    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const invitationRepository = {
      findOne: jest.fn().mockResolvedValue(invitation),
    };

    const membershipRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'existing-membership',
        workspaceId,
        userId: invitedUserId,
      }),
      create: jest.fn(),
      save: jest.fn(),
    };

    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Workspace) {
          return workspaceRepository;
        }

        if (entity === WorkspaceInvitation) {
          return invitationRepository;
        }

        if (entity === WorkspaceMembership) {
          return membershipRepository;
        }

        throw new Error('Unexpected repository');
      }),
    };

    const dataSource = {
      transaction: jest.fn(
        async (callback) => callback(manager),
      ),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    await expect(
      service.acceptInvitation(
        workspaceId,
        invitationId,
        invitedUserId,
      ),
    ).rejects.toThrow(ConflictException);

    expect(
      membershipRepository.create,
    ).not.toHaveBeenCalled();

    expect(
      membershipRepository.save,
    ).not.toHaveBeenCalled();
  });
});


describe('WorkspacesService rejectInvitation', () => {
  const ownerId = '1897c53b-478a-414d-b332-ae6db9d6d6da';
  const invitedUserId = '53e0d5fb-864d-42e1-9ba7-03b49945df4f';
  const workspaceId = '4eb53fcb-011b-4f42-b4c3-6f5d5fd62b64';
  const invitationId = '7e09d3cb-9eb1-477e-8a7b-9aa3c7596a49';

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

  function makeInvitation(): WorkspaceInvitation {
    return {
      id: invitationId,
      workspaceId,
      invitedById: ownerId,
      invitedUserId,
      invitedEmail: null,
      status: InvitationStatus.PENDING,
      tokenHash: null,
      expiresAt: null,
      respondedAt: null,
      createdAt: new Date(),
    } as WorkspaceInvitation;
  }

  it('rejects a pending invitation', async () => {
    const invitation = makeInvitation();

    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const invitationRepository = {
      findOne: jest.fn().mockResolvedValue(invitation),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === Workspace) {
          return workspaceRepository;
        }

        if (entity === WorkspaceInvitation) {
          return invitationRepository;
        }

        throw new Error('Unexpected repository');
      }),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    const response = await service.rejectInvitation(
      workspaceId,
      invitationId,
      invitedUserId,
    );

    expect(invitation.status).toBe(
      InvitationStatus.REJECTED,
    );

    expect(invitation.respondedAt).toBeInstanceOf(Date);

    expect(invitationRepository.save).toHaveBeenCalledWith(
      invitation,
    );

    expect(response.status).toBe(
      InvitationStatus.REJECTED,
    );
  });

  it('returns 404 when rejecting from a missing workspace', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const dataSource = {
      getRepository: jest.fn().mockReturnValue(
        workspaceRepository,
      ),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    await expect(
      service.rejectInvitation(
        workspaceId,
        invitationId,
        invitedUserId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 404 when invitation does not exist', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const invitationRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === Workspace) {
          return workspaceRepository;
        }

        if (entity === WorkspaceInvitation) {
          return invitationRepository;
        }

        throw new Error('Unexpected repository');
      }),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    await expect(
      service.rejectInvitation(
        workspaceId,
        invitationId,
        invitedUserId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 403 when another user tries to reject', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const invitationRepository = {
      findOne: jest.fn().mockResolvedValue(makeInvitation()),
    };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === Workspace) {
          return workspaceRepository;
        }

        if (entity === WorkspaceInvitation) {
          return invitationRepository;
        }

        throw new Error('Unexpected repository');
      }),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    await expect(
      service.rejectInvitation(
        workspaceId,
        invitationId,
        ownerId,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns 409 when invitation is no longer pending', async () => {
    const invitation = makeInvitation();
    invitation.status = InvitationStatus.REJECTED;

    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const invitationRepository = {
      findOne: jest.fn().mockResolvedValue(invitation),
    };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === Workspace) {
          return workspaceRepository;
        }

        if (entity === WorkspaceInvitation) {
          return invitationRepository;
        }

        throw new Error('Unexpected repository');
      }),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    await expect(
      service.rejectInvitation(
        workspaceId,
        invitationId,
        invitedUserId,
      ),
    ).rejects.toThrow(ConflictException);
  });
});


describe('WorkspacesService cancelInvitation', () => {
  const ownerId = '1897c53b-478a-414d-b332-ae6db9d6d6da';
  const otherUserId = '53e0d5fb-864d-42e1-9ba7-03b49945df4f';
  const workspaceId = '4eb53fcb-011b-4f42-b4c3-6f5d5fd62b64';
  const invitationId = 'd909eac9-8dcd-4b2f-966f-51fd50f685ec';

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

  function makeInvitation(): WorkspaceInvitation {
    return {
      id: invitationId,
      workspaceId,
      invitedById: ownerId,
      invitedUserId: otherUserId,
      invitedEmail: null,
      status: InvitationStatus.PENDING,
      tokenHash: null,
      expiresAt: null,
      respondedAt: null,
      createdAt: new Date(),
    } as WorkspaceInvitation;
  }

  it('cancels a pending invitation', async () => {
    const invitation = makeInvitation();

    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const invitationRepository = {
      findOne: jest.fn().mockResolvedValue(invitation),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === Workspace) return workspaceRepository;
        if (entity === WorkspaceInvitation) return invitationRepository;
        throw new Error('Unexpected repository');
      }),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    const response = await service.cancelInvitation(
      workspaceId,
      invitationId,
      ownerId,
    );

    expect(invitation.status).toBe(
      InvitationStatus.CANCELLED,
    );
    expect(invitation.respondedAt).toBeInstanceOf(Date);
    expect(invitationRepository.save).toHaveBeenCalledWith(
      invitation,
    );
    expect(response.status).toBe(
      InvitationStatus.CANCELLED,
    );
  });

  it('returns 404 when workspace does not exist', async () => {
    const dataSource = {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
      }),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    await expect(
      service.cancelInvitation(
        workspaceId,
        invitationId,
        ownerId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 403 when current user is not workspace owner', async () => {
    const dataSource = {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(makeWorkspace()),
      }),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    await expect(
      service.cancelInvitation(
        workspaceId,
        invitationId,
        otherUserId,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns 404 when invitation does not exist', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const invitationRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === Workspace) return workspaceRepository;
        if (entity === WorkspaceInvitation) return invitationRepository;
        throw new Error('Unexpected repository');
      }),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    await expect(
      service.cancelInvitation(
        workspaceId,
        invitationId,
        ownerId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 409 when invitation is no longer pending', async () => {
    const invitation = makeInvitation();
    invitation.status = InvitationStatus.REJECTED;

    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const invitationRepository = {
      findOne: jest.fn().mockResolvedValue(invitation),
    };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === Workspace) return workspaceRepository;
        if (entity === WorkspaceInvitation) return invitationRepository;
        throw new Error('Unexpected repository');
      }),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    await expect(
      service.cancelInvitation(
        workspaceId,
        invitationId,
        ownerId,
      ),
    ).rejects.toThrow(ConflictException);
  });
});


describe('WorkspacesService kanban settings', () => {
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

  function makeSettings(): WorkspaceKanbanSetting {
    return {
      id: '11111111-1111-4111-8111-111111111111',
      workspaceId,
      activeWipLimit: 3,
      definitionOfReady: null,
      definitionOfDone: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as WorkspaceKanbanSetting;
  }

  it('returns kanban settings for a workspace member', async () => {
    const settings = makeSettings();

    const dataSource = {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(settings),
      }),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    jest.spyOn(service, 'findOneForUser').mockResolvedValue(
      makeWorkspace() as any,
    );

    const result = await service.getKanbanSettings(
      workspaceId,
      memberId,
    );

    expect(service.findOneForUser).toHaveBeenCalledWith(
      workspaceId,
      memberId,
    );
    expect(result.activeWipLimit).toBe(3);
    expect(result.workspaceId).toBe(workspaceId);
  });

  it('returns 403 when non-member reads kanban settings', async () => {
    const service = new WorkspacesService(
      {} as DataSource,
      {} as UsersService,
    );

    jest.spyOn(service, 'findOneForUser').mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      service.getKanbanSettings(workspaceId, memberId),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns 404 when kanban settings do not exist', async () => {
    const dataSource = {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
      }),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    jest.spyOn(service, 'findOneForUser').mockResolvedValue(
      makeWorkspace() as any,
    );

    await expect(
      service.getKanbanSettings(workspaceId, ownerId),
    ).rejects.toThrow(NotFoundException);
  });

  it('allows owner to update kanban settings', async () => {
    const settings = makeSettings();

    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const settingsRepository = {
      findOne: jest.fn().mockResolvedValue(settings),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === Workspace) return workspaceRepository;
        if (entity === WorkspaceKanbanSetting) {
          return settingsRepository;
        }
        throw new Error('Unexpected repository');
      }),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    const result = await service.updateKanbanSettings(
      workspaceId,
      ownerId,
      {
        activeWipLimit: 5,
        definitionOfReady: ['requirements clear'],
        definitionOfDone: ['tests pass'],
      },
    );

    expect(result.activeWipLimit).toBe(5);
    expect(result.definitionOfReady).toEqual([
      'requirements clear',
    ]);
    expect(result.definitionOfDone).toEqual([
      'tests pass',
    ]);
    expect(settingsRepository.save).toHaveBeenCalled();
  });

  it('returns 400 for empty kanban settings update', async () => {
    const service = new WorkspacesService(
      {} as DataSource,
      {} as UsersService,
    );

    await expect(
      service.updateKanbanSettings(
        workspaceId,
        ownerId,
        {},
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns 404 when updating settings of missing workspace', async () => {
    const dataSource = {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
      }),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    await expect(
      service.updateKanbanSettings(
        workspaceId,
        ownerId,
        { activeWipLimit: 5 },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 403 when non-owner updates kanban settings', async () => {
    const dataSource = {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(makeWorkspace()),
      }),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    await expect(
      service.updateKanbanSettings(
        workspaceId,
        memberId,
        { activeWipLimit: 5 },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns 404 when kanban settings row is missing during update', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue(makeWorkspace()),
    };

    const settingsRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === Workspace) return workspaceRepository;
        if (entity === WorkspaceKanbanSetting) {
          return settingsRepository;
        }
        throw new Error('Unexpected repository');
      }),
    } as unknown as DataSource;

    const service = new WorkspacesService(
      dataSource,
      {} as UsersService,
    );

    await expect(
      service.updateKanbanSettings(
        workspaceId,
        ownerId,
        { activeWipLimit: 5 },
      ),
    ).rejects.toThrow(NotFoundException);
  });
});

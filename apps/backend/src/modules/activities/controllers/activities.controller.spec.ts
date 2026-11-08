jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

jest.mock('../../auth/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class JwtAuthGuard {},
}));

import { ActivitiesController } from './activities.controller';

describe('ActivitiesController', () => {
  const workspaceId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';

  let activitiesService: {
    findAllForWorkspace: jest.Mock;
  };

  let workspacesService: {
    findOneForUser: jest.Mock;
  };

  let controller: ActivitiesController;

  beforeEach(() => {
    activitiesService = {
      findAllForWorkspace: jest.fn(),
    };

    workspacesService = {
      findOneForUser: jest.fn(),
    };

    controller = new ActivitiesController(
      activitiesService as never,
      workspacesService as never,
    );
  });

  it('checks workspace access before listing activities', async () => {
    workspacesService.findOneForUser.mockResolvedValue({
      id: workspaceId,
    });

    activitiesService.findAllForWorkspace.mockResolvedValue([]);

    const request = {
      user: {
        id: userId,
      },
    };

    const result = await controller.findAll(workspaceId, request as never, {
      page: 1,
      limit: 20,
    });

    expect(workspacesService.findOneForUser).toHaveBeenCalledWith(
      workspaceId,
      userId,
    );

    expect(activitiesService.findAllForWorkspace).toHaveBeenCalledWith(
      workspaceId,
      {
        page: 1,
        limit: 20,
      },
    );

    expect(result).toEqual([]);
  });

  it('does not list activities when workspace access fails', async () => {
    workspacesService.findOneForUser.mockRejectedValue(new Error('Forbidden'));

    await expect(
      controller.findAll(
        workspaceId,
        {
          user: {
            id: userId,
          },
        } as never,
        {
          page: 1,
          limit: 20,
        },
      ),
    ).rejects.toThrow('Forbidden');

    expect(activitiesService.findAllForWorkspace).not.toHaveBeenCalled();
  });
});

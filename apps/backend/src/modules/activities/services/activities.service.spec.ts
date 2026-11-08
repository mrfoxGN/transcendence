import { Activity } from '../entities/activity.entity';
import { ActivitiesService } from './activities.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

function makeRepository() {
  return {
    create: jest.fn((data: Partial<Activity>): Activity =>
      Object.assign(new Activity(), data),
    ),
    save: jest.fn((entity: Activity): Promise<Activity> =>
      Promise.resolve(entity),
    ),
    find: jest.fn((): Promise<Activity[]> => Promise.resolve([])),
  };
}

describe('ActivitiesService', () => {
  const workspaceId = '11111111-1111-4111-8111-111111111111';
  const actorUserId = '22222222-2222-4222-8222-222222222222';

  let repository: ReturnType<typeof makeRepository>;
  let service: ActivitiesService;

  beforeEach(() => {
    repository = makeRepository();
    service = new ActivitiesService(repository as never);
  });

  it('creates an activity', async () => {
    const result = await service.create({
      workspaceId,
      actorUserId,
      actionType: 'FILE_UPLOADED',
      resourceType: 'workspace_file',
      resourceId: '33333333-3333-4333-8333-333333333333',
      metadata: {
        fileName: 'report.pdf',
      },
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        actorUserId,
        actionType: 'FILE_UPLOADED',
        resourceType: 'workspace_file',
        resourceId: '33333333-3333-4333-8333-333333333333',
        metadata: {
          fileName: 'report.pdf',
        },
      }),
    );

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(result.workspaceId).toBe(workspaceId);
    expect(result.actorUserId).toBe(actorUserId);
    expect(result.actionType).toBe('FILE_UPLOADED');
  });

  it('uses null defaults for optional activity fields', async () => {
    const result = await service.create({
      workspaceId,
      actionType: 'SYSTEM_EVENT',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        actorUserId: null,
        resourceType: null,
        resourceId: null,
        metadata: null,
      }),
    );

    expect(result.actorUserId).toBeNull();
  });

  it('lists workspace activities newest first with pagination', async () => {
    const activities = [
      Object.assign(new Activity(), {
        id: 'activity-1',
        workspaceId,
        actorUserId,
        actionType: 'FILE_UPLOADED',
        resourceType: 'workspace_file',
        resourceId: null,
        metadata: null,
        createdAt: new Date(),
      }),
    ];

    repository.find.mockResolvedValue(activities);

    const result = await service.findAllForWorkspace(workspaceId, {
      page: 2,
      limit: 10,
    });

    expect(repository.find).toHaveBeenCalledWith({
      where: {
        workspaceId,
      },
      order: {
        createdAt: 'DESC',
      },
      skip: 10,
      take: 10,
    });

    expect(result).toHaveLength(1);
    expect(result[0].actionType).toBe('FILE_UPLOADED');
  });
});

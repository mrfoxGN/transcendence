import { Activity } from '../entities/activity.entity';
import { ActivitiesService } from './activities.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

function makeRepository() {
  return {
    manager: { query: jest.fn().mockResolvedValue([]) },
    create: jest.fn((data: Partial<Activity>): Activity =>
      Object.assign(new Activity(), data),
    ),
    save: jest.fn((entity: Activity): Promise<Activity> =>
      Promise.resolve(entity),
    ),
    find: jest.fn((_options: unknown): Promise<Activity[]> => Promise.resolve([])),
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
        actionType: expect.anything(),
      },
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip: 10,
      take: 10,
    });

    expect(result).toHaveLength(1);
    expect(result[0].actionType).toBe('FILE_UPLOADED');
  });

  it('applies filters in the query and uses an extra row to detect the next page', async () => {
    const activities = [new Activity(), new Activity()];
    repository.find.mockResolvedValueOnce(activities).mockResolvedValueOnce(activities.slice(0, 1));
    const query = {
      category: 'files' as const,
      actorUserId,
      from: '2026-11-01T00:00:00Z',
      before: '2026-11-02T00:00:00Z',
      page: 1,
      limit: 1,
    };

    const firstPage = await service.findPageForWorkspace(workspaceId, query);
    const lastPage = await service.findPageForWorkspace(workspaceId, { ...query, page: 2 });

    const options = repository.find.mock.calls[0][0] as {
      where: { workspaceId: string; actorUserId: string; actionType: { objectLiteralParameters: unknown }; createdAt: { type: string } };
    };
    expect(options.where.workspaceId).toBe(workspaceId);
    expect(options.where.actorUserId).toBe(actorUserId);
    expect(options.where.actionType.objectLiteralParameters).toEqual({ activityPrefix: 'FILE!_%' });
    expect(options.where.createdAt.type).toBe('and');
    expect(repository.find).toHaveBeenNthCalledWith(2, expect.objectContaining({ skip: 1, take: 2 }));
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.hasNext).toBe(true);
    expect(lastPage.items).toHaveLength(1);
    expect(lastPage.hasNext).toBe(false);
  });

  it('rejects a reversed time range before querying the feed', async () => {
    await expect(service.findPageForWorkspace(workspaceId, {
      page: 1,
      limit: 20,
      from: '2026-11-03T00:00:00Z',
      before: '2026-11-02T00:00:00Z',
    })).rejects.toThrow('The start must be before the end');
    expect(repository.find).not.toHaveBeenCalled();
  });

  it('separates current and legacy audit events from the shared feed', async () => {
    await service.findAllForWorkspace(workspaceId, {});
    await service.findPageForWorkspace(workspaceId, {}, true);
    const [shared, audit] = repository.find.mock.calls.map(([options]) =>
      (options as { where: { actionType: { getSql: (column: string) => string } } }).where.actionType.getSql('action_type'));
    expect(shared).toContain("NOT LIKE :activityPrefix ESCAPE '!' AND action_type <> 'MEMBER_REMOVED'");
    expect(audit).toContain("LIKE :activityPrefix ESCAPE '!' OR action_type = 'MEMBER_REMOVED'");
  });
});

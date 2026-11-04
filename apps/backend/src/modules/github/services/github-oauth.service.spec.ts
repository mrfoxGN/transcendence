jest.mock('../../workspaces/services/workspaces.service', () => ({
  WorkspacesService: class WorkspacesService {},
}));

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

import type { WorkspacesService } from '../../workspaces/services/workspaces.service';
import { GitHubOAuthService } from './github-oauth.service';

describe('GitHubOAuthService', () => {
  let service: GitHubOAuthService;

  const workspaceId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';

  const configValues: Record<string, string> = {
    GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
    GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
    GITHUB_OAUTH_CALLBACK_URL:
      'http://localhost:3000/github/callback',
  };

  const workspacesService = {
    assertOwner: jest.fn(),
  };

  const configService = {
    getOrThrow: jest.fn((key: string) => configValues[key]),
  };

  const mockGitHubSuccess = () => {
    return jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'gho_test_token',
            scope: 'admin:repo_hook',
            token_type: 'bearer',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 123456,
            login: 'octocat',
          }),
          { status: 200 },
        ),
      );
  };

  const startOAuth = async () => {
    const result = await service.begin(workspaceId, userId);
    const url = new URL(result.authorizationUrl);

    return {
      url,
      state: url.searchParams.get('state')!,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    workspacesService.assertOwner.mockResolvedValue(undefined);

    service = new GitHubOAuthService(
      configService as unknown as ConfigService,
      workspacesService as unknown as WorkspacesService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows workspace owners to begin OAuth', async () => {
    const { url } = await startOAuth();

    expect(workspacesService.assertOwner).toHaveBeenCalledWith(
      workspaceId,
      userId,
    );

    expect(url.origin).toBe('https://github.com');
    expect(url.pathname).toBe('/login/oauth/authorize');

    expect(url.searchParams.get('client_id')).toBe(
      'test-client-id',
    );

    expect(url.searchParams.get('scope')).toBe(
      'admin:repo_hook',
    );
  });

  it('rejects non-workspace owners', async () => {
    workspacesService.assertOwner.mockRejectedValueOnce(
      new ForbiddenException(),
    );

    await expect(
      service.begin(workspaceId, userId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('generates secure OAuth state and PKCE parameters', async () => {
    const { url, state } = await startOAuth();

    const challenge = url.searchParams.get('code_challenge');

    expect(state.length).toBeGreaterThanOrEqual(32);
    expect(challenge).toHaveLength(43);

    expect(
      url.searchParams.get('code_challenge_method'),
    ).toBe('S256');
  });

  it('rejects unknown OAuth states', async () => {
    await expect(
      service.complete('test-code', 'invalid-state'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects expired OAuth states', async () => {
    const { state } = await startOAuth();

    const now = Date.now();

    jest.spyOn(Date, 'now').mockReturnValue(
      now + 6 * 60 * 1000,
    );

    await expect(
      service.complete('test-code', state),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects empty authorization codes', async () => {
    const { state } = await startOAuth();

    await expect(
      service.complete('', state),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exchanges the code and verifies the GitHub user', async () => {
    const { url, state } = await startOAuth();

    const fetchMock = mockGitHubSuccess();

    const result = await service.complete(
      'test-code',
      state,
    );

    expect(result.githubUserId).toBe('123456');
    expect(result.githubLogin).toBe('octocat');
    expect(result.workspaceId).toBe(workspaceId);

    expect(result.setupSessionId).toBeTruthy();

    const tokenRequest = fetchMock.mock.calls[0][1];

    const body = tokenRequest?.body as URLSearchParams;

    const verifier = body.get('code_verifier');

    expect(verifier).toBeTruthy();

    const expectedChallenge = createHash('sha256')
      .update(verifier!)
      .digest('base64url');

    expect(expectedChallenge).toBe(
      url.searchParams.get('code_challenge'),
    );

    expect(JSON.stringify(result)).not.toContain(
      'gho_test_token',
    );
  });

  it('prevents OAuth state replay', async () => {
    const { state } = await startOAuth();

    mockGitHubSuccess();

    await service.complete('test-code', state);

    await expect(
      service.complete('test-code', state),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('binds setup sessions to the correct workspace and user', async () => {
    const { state } = await startOAuth();

    mockGitHubSuccess();

    const result = await service.complete(
      'test-code',
      state,
    );

    const token = await service.getSetupAccessToken(
      result.setupSessionId,
      workspaceId,
      userId,
    );

    expect(token).toBe('gho_test_token');

    await expect(
      service.getSetupAccessToken(
        result.setupSessionId,
        workspaceId,
        'another-user',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects expired setup sessions', async () => {
    const { state } = await startOAuth();

    mockGitHubSuccess();

    const result = await service.complete(
      'test-code',
      state,
    );

    const now = Date.now();

    jest.spyOn(Date, 'now').mockReturnValue(
      now + 11 * 60 * 1000,
    );

    await expect(
      service.getSetupAccessToken(
        result.setupSessionId,
        workspaceId,
        userId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects missing GitHub webhook permissions', async () => {
    const { state } = await startOAuth();

    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'gho_test_token',
          scope: 'read:user',
        }),
        { status: 200 },
      ),
    );

    await expect(
      service.complete('test-code', state),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('handles GitHub connection failures', async () => {
    const { state } = await startOAuth();

    jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('Connection failed'),
    );

    await expect(
      service.complete('test-code', state),
    ).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

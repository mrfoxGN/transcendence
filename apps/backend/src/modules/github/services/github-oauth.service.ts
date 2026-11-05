import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';

import { WorkspacesService } from '../../workspaces/services/workspaces.service';

interface PendingOAuth {
  workspaceId: string;
  userId: string;
  codeVerifier: string;
  expiresAt: number;
}

interface SetupSession {
  workspaceId: string;
  userId: string;
  accessToken: string;
  githubUserId: string;
  githubLogin: string;
  expiresAt: number;
}

@Injectable()
export class GitHubOAuthService {
  private readonly pendingStates = new Map<string, PendingOAuth>();
  private readonly setupSessions = new Map<string, SetupSession>();

  private readonly stateTtl = 5 * 60 * 1000;
  private readonly sessionTtl = 10 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async begin(
    workspaceId: string,
    userId: string,
  ): Promise<{ authorizationUrl: string }> {
    await this.workspacesService.assertOwner(workspaceId, userId);

    if (this.pendingStates.size >= 1000) {
      throw new HttpException(
        'Too many pending GitHub authorizations',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');

    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const clientId = this.configService.getOrThrow<string>(
      'GITHUB_OAUTH_CLIENT_ID',
    );

    const callbackUrl = this.configService.getOrThrow<string>(
      'GITHUB_OAUTH_CALLBACK_URL',
    );

    const url = new URL('https://github.com/login/oauth/authorize');

    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', callbackUrl);
    url.searchParams.set('scope', 'read:user');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    this.pendingStates.set(state, {
      workspaceId,
      userId,
      codeVerifier,
      expiresAt: Date.now() + this.stateTtl,
    });

    setTimeout(() => {
      this.pendingStates.delete(state);
    }, this.stateTtl).unref();

    return {
      authorizationUrl: url.toString(),
    };
  }

  async complete(
    code: string,
    state: string,
  ): Promise<{
    message: string;
    workspaceId: string;
    githubUserId: string;
    githubLogin: string;
    setupSessionId: string;
  }> {
    const pending = this.pendingStates.get(state);

    if (!pending) {
      throw new BadRequestException('Invalid OAuth state');
    }

    this.pendingStates.delete(state);

    if (pending.expiresAt <= Date.now()) {
      throw new BadRequestException('Expired OAuth state');
    }

    if (!code || code.length > 512) {
      throw new BadRequestException(
        'Invalid GitHub authorization code',
      );
    }

    const clientId = this.configService.getOrThrow<string>(
      'GITHUB_OAUTH_CLIENT_ID',
    );

    const clientSecret = this.configService.getOrThrow<string>(
      'GITHUB_OAUTH_CLIENT_SECRET',
    );

    const callbackUrl = this.configService.getOrThrow<string>(
      'GITHUB_OAUTH_CALLBACK_URL',
    );

    const tokenResponse = await this.fetchJson(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: callbackUrl,
          code_verifier: pending.codeVerifier,
        }),
      },
    );

    if (
      !this.isRecord(tokenResponse) ||
      typeof tokenResponse.access_token !== 'string' ||
      !tokenResponse.access_token ||
      typeof tokenResponse.scope !== 'string'
    ) {
      throw new BadRequestException(
        'GitHub token exchange failed',
      );
    }

    const accessToken = tokenResponse.access_token;

    const githubUser = await this.fetchJson(
      'https://api.github.com/user',
      {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'Transcendence',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (
      !this.isRecord(githubUser) ||
      typeof githubUser.id !== 'number' ||
      !Number.isSafeInteger(githubUser.id) ||
      typeof githubUser.login !== 'string'
    ) {
      throw new BadGatewayException(
        'Invalid GitHub user information',
      );
    }

    const setupSessionId = randomBytes(32).toString('base64url');

    this.setupSessions.set(setupSessionId, {
      workspaceId: pending.workspaceId,
      userId: pending.userId,
      accessToken,
      githubUserId: String(githubUser.id),
      githubLogin: githubUser.login,
      expiresAt: Date.now() + this.sessionTtl,
    });

    setTimeout(() => {
      this.setupSessions.delete(setupSessionId);
    }, this.sessionTtl).unref();

    return {
      message: 'GitHub authentication successful',
      workspaceId: pending.workspaceId,
      githubUserId: String(githubUser.id),
      githubLogin: githubUser.login,
      setupSessionId,
    };
  }

  async getSetupAccessToken(
    setupSessionId: string,
    workspaceId: string,
    userId: string,
  ): Promise<string> {
    await this.workspacesService.assertOwner(workspaceId, userId);

    const session = this.setupSessions.get(setupSessionId);

    if (
      !session ||
      session.expiresAt <= Date.now() ||
      session.workspaceId !== workspaceId ||
      session.userId !== userId
    ) {
      throw new ForbiddenException(
        'Invalid or expired GitHub setup session',
      );
    }

    return session.accessToken;
  }

  deleteSetupSession(setupSessionId: string): void {
    this.setupSessions.delete(setupSessionId);
  }

  private async fetchJson(
    url: string,
    options: RequestInit,
  ): Promise<unknown> {
    let response: Response;

    try {
      response = await fetch(url, {
        ...options,
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'GitHub is temporarily unavailable',
      );
    }

    if (!response.ok) {
      throw new BadGatewayException(
        'GitHub authentication request failed',
      );
    }

    try {
      return await response.json();
    } catch {
      throw new BadGatewayException(
        'Invalid GitHub response',
      );
    }
  }

  private isRecord(
    value: unknown,
  ): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    );
  }
}

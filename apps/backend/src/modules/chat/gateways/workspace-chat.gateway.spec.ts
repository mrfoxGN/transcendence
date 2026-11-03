import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { UserStatus } from '../../../database/enums/database.enums';
import { UsersService } from '../../users/services/users.service';
import { WorkspacesService } from '../../workspaces/services/workspaces.service';
import { WorkspaceChatGateway } from './workspace-chat.gateway';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

describe('WorkspaceChatGateway', () => {
  const userId = '9afb3d2a-5d0a-4544-a9fc-6cdb465de34b';
  const workspaceId = '62a9bb1e-bf7b-4d38-a986-14f730579045';

  let jwtService: {
    verifyAsync: jest.Mock;
  };

  let usersService: {
    findForAuth: jest.Mock;
  };

  let workspacesService: {
    findOneForUser: jest.Mock;
  };

  let gateway: WorkspaceChatGateway;

  const makeClient = (token: unknown = 'valid-token') => {
    let disconnectHandler: (() => void) | undefined;

    return {
      handshake: {
        auth: {
          token,
        },
      },
      data: {},
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      disconnect: jest.fn(),
      once: jest.fn((event: string, handler: () => void) => {
        if (event === 'disconnect') {
          disconnectHandler = handler;
        }
      }),
      triggerDisconnect: () => {
        disconnectHandler?.();
      },
    };
  };

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: userId,
        tokenVersion: 0,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    };

    usersService = {
      findForAuth: jest.fn().mockResolvedValue({
        user: { id: userId, status: UserStatus.ACTIVE },
        tokenVersion: 0,
      }),
    };

    workspacesService = {
      findOneForUser: jest.fn().mockResolvedValue({
        id: workspaceId,
      }),
    };

    gateway = new WorkspaceChatGateway(
      jwtService as unknown as JwtService,
      usersService as unknown as UsersService,
      workspacesService as unknown as WorkspacesService,
    );
  });

  it('authenticates a socket and stores the user id', async () => {
    const client = makeClient();

    await gateway.handleConnection(client as never);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith(
      'valid-token',
    );

    expect(usersService.findForAuth).toHaveBeenCalledWith(
      userId,
    );

    expect(client.data.userId).toBe(userId);
    expect(client.disconnect).not.toHaveBeenCalled();

    client.triggerDisconnect();
  });

  it('disconnects when token is missing', async () => {
    const client = makeClient(null);

    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalled();
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('disconnects when JWT verification fails', async () => {
    jwtService.verifyAsync.mockRejectedValue(
      new Error('Invalid token'),
    );

    const client = makeClient();

    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalled();
  });

  it('disconnects an inactive user', async () => {
    usersService.findForAuth.mockResolvedValue({
      user: { id: userId, status: UserStatus.DISABLED },
      tokenVersion: 0,
    });

    const client = makeClient();

    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalled();
  });

  it('disconnects when the token version was revoked', async () => {
    usersService.findForAuth.mockResolvedValue({
      user: { id: userId, status: UserStatus.ACTIVE },
      tokenVersion: 1,
    });

    const client = makeClient();
    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalled();
  });

  it('allows a workspace member to join the workspace room', async () => {
    const client = makeClient();
    client.data.userId = userId;

    await gateway.joinWorkspace(
      client as never,
      workspaceId,
    );

    expect(workspacesService.findOneForUser).toHaveBeenCalledWith(
      workspaceId,
      userId,
    );

    expect(client.join).toHaveBeenCalledWith(
      `workspace:${workspaceId}`,
    );
  });

  it('does not allow an outsider to join a workspace room', async () => {
    workspacesService.findOneForUser.mockRejectedValue(
      new ForbiddenException(),
    );

    const client = makeClient();
    client.data.userId = userId;

    await expect(
      gateway.joinWorkspace(
        client as never,
        workspaceId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(client.join).not.toHaveBeenCalled();
  });

  it('disconnects when an unauthenticated socket tries to join', async () => {
    const client = makeClient();

    await gateway.joinWorkspace(
      client as never,
      workspaceId,
    );

    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
    expect(
      workspacesService.findOneForUser,
    ).not.toHaveBeenCalled();
  });

  it('emits a created message to the workspace room', () => {
    const emit = jest.fn();

    const to = jest.fn().mockReturnValue({
      emit,
    });

    (gateway as unknown as {
      server: {
        to: jest.Mock;
      };
    }).server = {
      to,
    };

    const message = {
      id: '73362c61-b9c9-45f0-aeec-30542510fc79',
      workspaceId,
      senderId: userId,
      content: 'Hello workspace!',
      createdAt: new Date('2026-10-30T15:12:49.749Z'),
    };

    gateway.emitMessageCreated(
      workspaceId,
      message,
    );

    expect(to).toHaveBeenCalledWith(
      `workspace:${workspaceId}`,
    );

    expect(emit).toHaveBeenCalledWith(
      'workspace-message.created',
      message,
    );
  });
});

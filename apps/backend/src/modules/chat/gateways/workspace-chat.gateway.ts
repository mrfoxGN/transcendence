import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { UserStatus } from '../../../database/enums/database.enums';
import { UsersService } from '../../users/services/users.service';
import { WorkspacesService } from '../../workspaces/services/workspaces.service';
import { ChatMessageResponseDto } from '../dto/chat-message-response.dto';

@WebSocketGateway()
export class WorkspaceChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token: unknown = client.handshake.auth?.token;

    if (typeof token !== 'string') {
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: unknown;
        exp?: unknown;
        tokenVersion?: unknown;
      }>(token);

      if (
        typeof payload.sub !== 'string' ||
        typeof payload.exp !== 'number' ||
        !Number.isInteger(payload.tokenVersion) ||
        (payload.tokenVersion as number) < 0
      ) {
        client.disconnect();
        return;
      }

      const authUser = await this.usersService.findForAuth(payload.sub);

      if (
        authUser.user.status !== UserStatus.ACTIVE ||
        authUser.tokenVersion !== payload.tokenVersion
      ) {
        client.disconnect();
        return;
      }

      const expiresInMs = payload.exp * 1000 - Date.now();

      if (expiresInMs <= 0) {
        client.disconnect();
        return;
      }

      const socketData = client.data as { userId?: unknown };
      socketData.userId = authUser.user.id;

      await client.join(`user:${authUser.user.id}`);

      client.emit('workspace-chat.ready');

      const timeout = setTimeout(() => client.disconnect(), expiresInMs);

      client.once('disconnect', () => clearTimeout(timeout));
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('workspace-chat.join')
  async joinWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() workspaceId: string,
  ): Promise<void> {
    const socketData = client.data as { userId?: unknown; activeWorkspace?: string };
    const userId = socketData.userId;

    if (typeof userId !== 'string') {
      client.disconnect();
      return;
    }

    socketData.activeWorkspace = workspaceId;
    await this.workspacesService.findOneForUser(workspaceId, userId);
    if (socketData.activeWorkspace === workspaceId) await client.join(`workspace:${workspaceId}`);
  }

  @SubscribeMessage('workspace-chat.watch')
  async watchWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() workspaceId: string,
  ): Promise<void> {
    const userId: unknown = client.data.userId;
    if (typeof userId !== 'string') return;
    await this.workspacesService.findOneForUser(workspaceId, userId);
    await client.join(`workspace-unread:${workspaceId}`);
    client.emit('workspace-chat.unread-changed', workspaceId);
  }

  @SubscribeMessage('workspace-chat.leave')
  async leaveWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() workspaceId: string,
  ): Promise<void> {
    if (client.data.activeWorkspace === workspaceId) delete client.data.activeWorkspace;
    await client.leave(`workspace:${workspaceId}`);
  }

  emitMessageCreated(
    workspaceId: string,
    message: ChatMessageResponseDto,
  ): void {
    this.server
      .to(`workspace:${workspaceId}`)
      .emit('workspace-message.created', message);
    this.server
      .to(`workspace-unread:${workspaceId}`)
      .except(`workspace:${workspaceId}`)
      .emit('workspace-chat.unread-changed', workspaceId);
  }

  disconnectUser(userId: string): void {
    this.server.in(`user:${userId}`).disconnectSockets(true);
  }

  emitReadUpdated(userId: string, workspaceId: string): void {
    this.server.to(`user:${userId}`).emit('workspace-chat.read', workspaceId);
  }
}

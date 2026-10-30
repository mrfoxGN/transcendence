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
      }>(token);

      if (
        typeof payload.sub !== 'string' ||
        typeof payload.exp !== 'number'
      ) {
        client.disconnect();
        return;
      }

      const user = await this.usersService.findById(payload.sub);

      if (user.status !== UserStatus.ACTIVE) {
        client.disconnect();
        return;
      }

      const expiresInMs = payload.exp * 1000 - Date.now();

      if (expiresInMs <= 0) {
        client.disconnect();
        return;
      }

      client.data.userId = user.id;

      client.emit('workspace-chat.ready');

      const timeout = setTimeout(
        () => client.disconnect(),
        expiresInMs,
      );

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
    const userId: unknown = client.data.userId;

    if (typeof userId !== 'string') {
      client.disconnect();
      return;
    }

    await this.workspacesService.findOneForUser(
      workspaceId,
      userId,
    );

    await client.join(`workspace:${workspaceId}`);
  }

  emitMessageCreated(
    workspaceId: string,
    message: ChatMessageResponseDto,
  ): void {
    this.server
      .to(`workspace:${workspaceId}`)
      .emit('workspace-message.created', message);
  }
}

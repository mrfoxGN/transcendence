import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { UserStatus } from '../../../database/enums/database.enums';
import { UsersService } from '../../users/services/users.service';
import { DirectMessageResponseDto } from '../dto/direct-message-response.dto';

@WebSocketGateway()
export class DirectChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
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

      await client.join(`user:${user.id}`);

      const timeout = setTimeout(() => client.disconnect(), expiresInMs);
      client.once('disconnect', () => clearTimeout(timeout));
    } catch {
      client.disconnect();
    }
  }

  emitMessageCreated(
    userAId: string,
    userBId: string,
    message: DirectMessageResponseDto,
  ): void {
    this.server
      .to(`user:${userAId}`)
      .to(`user:${userBId}`)
      .emit('direct-message.created', message);
  }
}
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';

import { ChatController } from './controllers/chat.controller';
import { ChatMessage } from './entities/chat-message.entity';
import { WorkspaceChatGateway } from './gateways/workspace-chat.gateway';
import { ChatService } from './services/chat.service';

@Module({
  imports: [
    UsersModule,
    WorkspacesModule,
    TypeOrmModule.forFeature([ChatMessage]),
  ],
  controllers: [ChatController],
  providers: [ChatService, WorkspaceChatGateway],
  exports: [ChatService],
})
export class ChatModule {}

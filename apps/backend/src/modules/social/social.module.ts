import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';
import { SocialController } from './controllers/social.controller';
import { DirectConversation } from './entities/direct-conversation.entity';
import { DirectMessage } from './entities/direct-message.entity';
import { Friendship } from './entities/friendship.entity';
import { DirectChatGateway } from './gateways/direct-chat.gateway';
import { SocialService } from './services/social.service';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([
      Friendship,
      DirectConversation,
      DirectMessage,
    ]),
  ],
  controllers: [SocialController],
  providers: [SocialService, DirectChatGateway],
  exports: [SocialService],
})
export class SocialModule {}
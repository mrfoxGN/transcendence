import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SocialController } from './controllers/social.controller';
import { DirectConversation } from './entities/direct-conversation.entity';
import { DirectMessage } from './entities/direct-message.entity';
import { Friendship } from './entities/friendship.entity';
import { SocialService } from './services/social.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Friendship, DirectConversation, DirectMessage]),
  ],
  controllers: [SocialController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Friendship } from '../social/entities/friendship.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { FriendshipsController } from './controllers/friendships.controller';
import { FriendshipsService } from './services/friendships.service';

@Module({
  imports: [UsersModule, TypeOrmModule.forFeature([Friendship, User])],
  controllers: [FriendshipsController],
  providers: [FriendshipsService],
  exports: [FriendshipsService],
})
export class FriendshipsModule {}

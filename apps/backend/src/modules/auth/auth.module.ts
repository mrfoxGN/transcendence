import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { ChatModule } from '../chat/chat.module';
import { SocialModule } from '../social/social.module';
import { User } from '../users/entities/user.entity';
import { AccountRecoveryController } from './controllers/account-recovery.controller';
import { AccountRecoveryService } from './services/account-recovery.service';

@Module({
  imports: [
    UsersModule,
    SocialModule,
    ChatModule,
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '23h' },
      }),
    }),
  ],
  controllers: [AuthController, AccountRecoveryController],
  providers: [AuthService, AccountRecoveryService],
})
export class AuthModule {}

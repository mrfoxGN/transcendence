import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ActivitiesController } from './controllers/activities.controller';
import { Activity } from './entities/activity.entity';
import { ActivitiesService } from './services/activities.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Activity]),
    UsersModule,
    forwardRef(() => WorkspacesModule),
  ],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ActivitiesModule } from '../activities/activities.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { FilesController } from './controllers/files.controller';
import { WorkspaceFile } from './entities/workspace-file.entity';
import { FilesService } from './services/files.service';

@Module({
  imports: [
    ActivitiesModule,
    UsersModule,
    WorkspacesModule,
    TasksModule,
    TypeOrmModule.forFeature([WorkspaceFile]),
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}

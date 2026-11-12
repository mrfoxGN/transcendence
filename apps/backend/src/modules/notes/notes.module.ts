import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';
import { ActivitiesModule } from '../activities/activities.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { NotesController } from './controllers/notes.controller';
import { Note } from './entities/note.entity';
import { NotesService } from './services/notes.service';

@Module({
  imports: [UsersModule, WorkspacesModule, ActivitiesModule, TypeOrmModule.forFeature([Note])],
  controllers: [NotesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}

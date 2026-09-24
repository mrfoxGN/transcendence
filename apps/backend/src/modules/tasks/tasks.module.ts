import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TasksController } from './controllers/tasks.controller';
import { Task } from './entities/task.entity';
import { TaskAssignment } from './entities/task-assignment.entity';
import { TaskComment } from './entities/task-comment.entity';
import { TaskDependency } from './entities/task-dependency.entity';
import { TaskStatusHistory } from './entities/task-status-history.entity';
import { TasksService } from './services/tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      TaskAssignment,
      TaskComment,
      TaskDependency,
      TaskStatusHistory,
    ]),
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}

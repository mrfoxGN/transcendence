import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ActivitiesModule } from '../activities/activities.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { TasksController } from './controllers/tasks.controller';
import { TaskAnalyticsController } from './controllers/task-analytics.controller';
import { Task } from './entities/task.entity';
import { TaskAssignment } from './entities/task-assignment.entity';
import { TaskComment } from './entities/task-comment.entity';
import { TaskDependency } from './entities/task-dependency.entity';
import { TaskStatusHistory } from './entities/task-status-history.entity';
import { TasksService } from './services/tasks.service';
import { TaskAnalyticsService } from './services/task-analytics.service';

@Module({
  imports: [
    ActivitiesModule,
    UsersModule,
    WorkspacesModule,
    TypeOrmModule.forFeature([
      Task,
      TaskAssignment,
      TaskComment,
      TaskDependency,
      TaskStatusHistory,
    ]),
  ],
  controllers: [TasksController, TaskAnalyticsController],
  providers: [TasksService, TaskAnalyticsService],
  exports: [TasksService],
})
export class TasksModule {}

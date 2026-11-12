import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ActivitiesModule } from '../activities/activities.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesController } from './controllers/workspaces.controller';
import { ProjectsController } from './controllers/projects.controller';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { WorkspaceKanbanSetting } from './entities/workspace-kanban-setting.entity';
import { WorkspaceMembership } from './entities/workspace-membership.entity';
import { WorkspacesService } from './services/workspaces.service';
import { ProjectsService } from './services/projects.service';

@Module({
  imports: [
    forwardRef(() => ActivitiesModule),
    UsersModule,
    NotificationsModule,
    TypeOrmModule.forFeature([
      Workspace,
      WorkspaceMembership,
      WorkspaceInvitation,
      WorkspaceKanbanSetting,
    ]),
  ],
  controllers: [WorkspacesController, ProjectsController],
  providers: [WorkspacesService, ProjectsService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}

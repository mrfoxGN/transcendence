import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';
import { WorkspacesController } from './controllers/workspaces.controller';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { WorkspaceKanbanSetting } from './entities/workspace-kanban-setting.entity';
import { WorkspaceMembership } from './entities/workspace-membership.entity';
import { WorkspacesService } from './services/workspaces.service';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([
      Workspace,
      WorkspaceMembership,
      WorkspaceInvitation,
      WorkspaceKanbanSetting,
    ]),
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}

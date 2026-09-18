import {
  Check,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';

import { Workspace } from './workspace.entity';

@Check(
  'chk_workspace_kanban_settings_active_wip_limit_positive',
  '`active_wip_limit` > 0',
)
@Entity('workspace_kanban_settings')
export class WorkspaceKanbanSetting {
  @PrimaryColumn({
    type: 'char',
    length: 36,
  })
  id!: string;

  @Column({
    name: 'workspace_id',
    type: 'char',
    length: 36,
  })
  workspaceId!: string;

  @OneToOne(() => Workspace, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'workspace_id',
  })
  workspace!: Workspace;

  @Column({
    name: 'active_wip_limit',
    type: 'int',
    default: 3,
  })
  activeWipLimit!: number;

  @Column({
    name: 'definition_of_ready',
    type: 'json',
    nullable: true,
  })
  definitionOfReady!: unknown | null;

  @Column({
    name: 'definition_of_done',
    type: 'json',
    nullable: true,
  })
  definitionOfDone!: unknown | null;

  @Column({
    name: 'created_at',
    type: 'datetime',
    precision: 6,
  })
  createdAt!: Date;

  @Column({
    name: 'updated_at',
    type: 'datetime',
    precision: 6,
  })
  updatedAt!: Date;
}

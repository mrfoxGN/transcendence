import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { User } from './user.entity';

@Entity('workspaces')
export class Workspace {
  @PrimaryColumn({
    type: 'char',
    length: 36,
  })
  id!: string;

  @Column({
    name: 'owner_id',
    type: 'char',
    length: 36,
  })
  ownerId!: string;

  @ManyToOne(() => User, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'owner_id',
  })
  owner!: User;

  @Column({
    type: 'varchar',
    length: 120,
  })
  name!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description!: string | null;

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

  @Column({
    name: 'archived_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  archivedAt!: Date | null;

  @Column({
    name: 'deleted_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  deletedAt!: Date | null;
}

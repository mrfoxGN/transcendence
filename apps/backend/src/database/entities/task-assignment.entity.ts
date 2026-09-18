import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';

import { Task } from './task.entity';
import { User } from './user.entity';

@Entity('task_assignments')
export class TaskAssignment {
  @PrimaryColumn({
    type: 'char',
    length: 36,
  })
  id!: string;

  @Column({
    name: 'task_id',
    type: 'char',
    length: 36,
  })
  taskId!: string;

  @OneToOne(() => Task, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'task_id',
  })
  task!: Task;

  @Column({
    name: 'user_id',
    type: 'char',
    length: 36,
  })
  userId!: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
  })
  user!: User;

  @Column({
    name: 'assigned_by_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  assignedById!: string | null;

  @ManyToOne(() => User, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({
    name: 'assigned_by_id',
  })
  assignedBy!: User | null;

  @Column({
    name: 'assigned_at',
    type: 'datetime',
    precision: 6,
  })
  assignedAt!: Date;
}

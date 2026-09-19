import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { WebhookStatus } from '../../../database/enums/database.enums';

import { Repository } from './repository.entity';

@Entity('github_webhook_deliveries')
export class GitHubWebhookDelivery {
  @PrimaryColumn({
    type: 'char',
    length: 36,
  })
  id!: string;

  @Column({
    name: 'delivery_id',
    type: 'varchar',
    length: 100,
    unique: true,
  })
  deliveryId!: string;

  @Column({
    name: 'repository_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  repositoryId!: string | null;

  @ManyToOne(() => Repository, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'repository_id',
  })
  repository!: Repository | null;

  @Column({
    name: 'event_type',
    type: 'varchar',
    length: 100,
  })
  eventType!: string;

  @Column({
    name: 'event_action',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  eventAction!: string | null;

  @Column({
    type: 'enum',
    enum: WebhookStatus,
  })
  status!: WebhookStatus;

  @Column({
    name: 'received_at',
    type: 'datetime',
    precision: 6,
  })
  receivedAt!: Date;

  @Column({
    name: 'processed_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  processedAt!: Date | null;

  @Column({
    name: 'error_message',
    type: 'text',
    nullable: true,
  })
  errorMessage!: string | null;
}

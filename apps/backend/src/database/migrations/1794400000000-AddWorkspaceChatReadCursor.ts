import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkspaceChatReadCursor1794400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE workspace_memberships
        ADD chat_read_at DATETIME(6) NULL,
        ADD chat_read_message_id CHAR(36) NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE workspace_memberships
        DROP COLUMN chat_read_message_id,
        DROP COLUMN chat_read_at
    `);
  }
}

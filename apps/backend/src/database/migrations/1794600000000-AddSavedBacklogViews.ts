import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSavedBacklogViews1794600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE workspace_memberships ADD backlog_views JSON NULL');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE workspace_memberships DROP COLUMN backlog_views');
  }
}

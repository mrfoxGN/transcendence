import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkspaceAndPersonalPreferences1795000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE workspaces ADD reporting_time_zone VARCHAR(80) NOT NULL DEFAULT 'Africa/Casablanca'");
    await queryRunner.query("ALTER TABLE users ADD theme ENUM('system','light','dark') NOT NULL DEFAULT 'system', ADD notification_badge BOOLEAN NOT NULL DEFAULT TRUE");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users DROP COLUMN notification_badge, DROP COLUMN theme');
    await queryRunner.query('ALTER TABLE workspaces DROP COLUMN reporting_time_zone');
  }
}

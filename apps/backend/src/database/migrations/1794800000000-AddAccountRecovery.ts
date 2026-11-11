import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountRecovery1794800000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users
      ADD verified_email VARCHAR(320) NULL,
      ADD email_verify_digest CHAR(64) NULL,
      ADD email_verify_expires_at DATETIME(6) NULL,
      ADD password_reset_digest CHAR(64) NULL,
      ADD password_reset_expires_at DATETIME(6) NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users
      DROP COLUMN verified_email, DROP COLUMN email_verify_digest, DROP COLUMN email_verify_expires_at,
      DROP COLUMN password_reset_digest, DROP COLUMN password_reset_expires_at`);
  }
}

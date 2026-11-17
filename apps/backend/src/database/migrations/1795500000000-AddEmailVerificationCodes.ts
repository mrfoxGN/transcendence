import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerificationCodes1795500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users
      ADD email_verify_code_hash VARCHAR(255) NULL,
      ADD email_verify_attempts INT NOT NULL DEFAULT 0`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users
      DROP COLUMN email_verify_code_hash,
      DROP COLUMN email_verify_attempts`);
  }
}

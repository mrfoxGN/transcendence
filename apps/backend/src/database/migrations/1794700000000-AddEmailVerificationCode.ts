import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerificationCode1794700000000 implements MigrationInterface {
  name = 'AddEmailVerificationCode1794700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` ADD `verified_email` varchar(320) NULL',
    );

    await queryRunner.query(
      'ALTER TABLE `users` ADD `email_verify_code_hash` varchar(255) NULL',
    );

    await queryRunner.query(
      'ALTER TABLE `users` ADD `email_verify_expires_at` datetime(6) NULL',
    );

    await queryRunner.query(
      'ALTER TABLE `users` ADD `email_verify_attempts` int NOT NULL DEFAULT 0',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` DROP COLUMN `email_verify_attempts`',
    );

    await queryRunner.query(
      'ALTER TABLE `users` DROP COLUMN `email_verify_expires_at`',
    );

    await queryRunner.query(
      'ALTER TABLE `users` DROP COLUMN `email_verify_code_hash`',
    );

    await queryRunner.query('ALTER TABLE `users` DROP COLUMN `verified_email`');
  }
}

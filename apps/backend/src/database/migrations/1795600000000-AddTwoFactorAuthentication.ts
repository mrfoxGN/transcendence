import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTwoFactorAuthentication1795600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users
      ADD is_two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users
      DROP COLUMN is_two_factor_enabled`);
  }
}
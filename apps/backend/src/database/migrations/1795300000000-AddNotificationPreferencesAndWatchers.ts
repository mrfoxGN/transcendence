import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationPreferencesAndWatchers1795300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE notification_preferences (
      user_id char(36) NOT NULL,
      category varchar(32) NOT NULL,
      PRIMARY KEY (user_id, category),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await queryRunner.query(`CREATE TABLE task_watchers (
      task_id char(36) NOT NULL,
      user_id char(36) NOT NULL,
      PRIMARY KEY (task_id, user_id),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE task_watchers');
    await queryRunner.query('DROP TABLE notification_preferences');
  }
}

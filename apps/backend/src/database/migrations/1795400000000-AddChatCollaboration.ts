import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatCollaboration1795400000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    for (const table of ['chat_messages', 'direct_messages']) {
      await runner.query(`ALTER TABLE ${table}
        ADD reply_to_id char(36) NULL,
        ADD attachment_name varchar(255) NULL,
        ADD attachment_data mediumblob NULL`);
    }
  }

  async down(runner: QueryRunner): Promise<void> {
    for (const table of ['chat_messages', 'direct_messages']) {
      await runner.query(`ALTER TABLE ${table}
        DROP reply_to_id, DROP attachment_name, DROP attachment_data`);
    }
  }
}

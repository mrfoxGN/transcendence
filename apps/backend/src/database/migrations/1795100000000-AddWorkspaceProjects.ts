import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkspaceProjects1795100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const tableOptions = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci';
    await queryRunner.query(`CREATE TABLE workspace_projects (
      id CHAR(36) PRIMARY KEY,
      workspace_id CHAR(36) NOT NULL,
      owner_membership_id CHAR(36) NULL,
      name VARCHAR(120) NOT NULL,
      target_date DATE NULL,
      status ENUM('planned','active','on-hold','completed') NOT NULL DEFAULT 'planned',
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_membership_id) REFERENCES workspace_memberships(id) ON DELETE SET NULL
    ) ${tableOptions}`);
    await queryRunner.query(`CREATE TABLE project_milestones (
      id CHAR(36) PRIMARY KEY,
      project_id CHAR(36) NOT NULL,
      name VARCHAR(120) NOT NULL,
      target_date DATE NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      FOREIGN KEY (project_id) REFERENCES workspace_projects(id) ON DELETE CASCADE
    ) ${tableOptions}`);
    await queryRunner.query(`CREATE TABLE project_task_links (
      task_id CHAR(36) PRIMARY KEY,
      project_id CHAR(36) NOT NULL,
      milestone_id CHAR(36) NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES workspace_projects(id) ON DELETE CASCADE,
      FOREIGN KEY (milestone_id) REFERENCES project_milestones(id) ON DELETE SET NULL
    ) ${tableOptions}`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE project_task_links');
    await queryRunner.query('DROP TABLE project_milestones');
    await queryRunner.query('DROP TABLE workspace_projects');
  }
}

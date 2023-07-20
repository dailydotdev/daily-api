import { MigrationInterface, QueryRunner } from 'typeorm';

export class WelcomeShowOnFeed1689854830946 implements MigrationInterface {
  name = 'WelcomeShowOnFeed1689854830946';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE post SET flags = flags || '{"showOnFeed": false}' WHERE type = 'welcome'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE post SET flags = flags || '{"showOnFeed": true}' WHERE type = 'welcome'`,
    );
  }
}

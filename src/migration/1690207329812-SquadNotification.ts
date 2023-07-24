import { MigrationInterface, QueryRunner } from 'typeorm';

export class SquadNotification1690207329812 implements MigrationInterface {
  name = 'SquadNotification1690207329812';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE notification SET "targetUrl" = 'https://app.daily.dev/squads/new?origin=notification' WHERE type = 'squad_access'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE notification SET "targetUrl" = 'https://app.daily.dev?squad=true' WHERE type = 'squad_access'`,
    );
  }
}

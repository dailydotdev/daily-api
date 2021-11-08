import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertsFullReplication1636372778451 implements MigrationInterface {
  name = 'AlertsFullReplication1636372778451';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."alerts" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."alerts" REPLICA IDENTITY DEFAULT`,
    );
  }
}

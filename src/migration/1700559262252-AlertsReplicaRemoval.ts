import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertsReplicaRemoval1700559262252 implements MigrationInterface {
  name = 'AlertsReplicaRemoval1700559262252';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."alerts" REPLICA IDENTITY DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."alerts" REPLICA IDENTITY FULL`,
    );
  }
}

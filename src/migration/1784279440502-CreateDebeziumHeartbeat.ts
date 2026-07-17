import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDebeziumHeartbeat1784279440502 implements MigrationInterface {
  name = 'CreateDebeziumHeartbeat1784279440502';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "heartbeat" (
        "id" integer NOT NULL,
        "ts" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_heartbeat" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP TABLE "heartbeat"
    `);
  }
}

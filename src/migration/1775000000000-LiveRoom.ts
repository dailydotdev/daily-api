import { MigrationInterface, QueryRunner } from 'typeorm';

export class LiveRoom1775000000000 implements MigrationInterface {
  name = 'LiveRoom1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "live_room" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "hostId" text NOT NULL,
        "topic" text NOT NULL,
        "mode" text NOT NULL,
        "status" text NOT NULL DEFAULT 'created',
        "startedAt" TIMESTAMPTZ,
        "endedAt" TIMESTAMPTZ,
        CONSTRAINT "PK_live_room_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_live_room_host_id" ON "live_room" ("hostId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_live_room_status" ON "live_room" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."IDX_live_room_status"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."IDX_live_room_host_id"
    `);
    await queryRunner.query(`
      DROP TABLE "live_room"
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkerJob1771247072466 implements MigrationInterface {
  name = 'WorkerJob1771247072466';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "worker_job" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" integer NOT NULL, "status" integer NOT NULL, "payload" jsonb, "result" jsonb, "error" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "startedAt" TIMESTAMP WITH TIME ZONE, "completedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_98ab1c14ff8d1cf80d18703b92f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_46b8d79c5c2f7f299f1b2c1ddf" ON "worker_job" ("type") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bac37f13b06c08534012dc3607" ON "worker_job" ("status") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_bac37f13b06c08534012dc3607"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_46b8d79c5c2f7f299f1b2c1ddf"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "worker_job"`);
  }
}

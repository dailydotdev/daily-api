import { MigrationInterface, QueryRunner } from "typeorm";

export class UserReport1736363898760 implements MigrationInterface {
  name = 'UserReport1736363898760'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "user_report" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reportedUserId" text NOT NULL, "userId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "reason" character varying(36) NOT NULL, "note" text, CONSTRAINT "PK_58c08f0e20fa66561b119421eb2" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_report_reported_user_id" ON "user_report" ("reportedUserId") `);
    await queryRunner.query(`ALTER TABLE "user_report" ADD CONSTRAINT "FK_cfc9cf9a552e98d6a634377496f" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_report" DROP CONSTRAINT "FK_cfc9cf9a552e98d6a634377496f"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_user_report_reported_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_report"`);
  }
}

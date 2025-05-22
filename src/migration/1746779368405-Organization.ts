import { MigrationInterface, QueryRunner } from "typeorm";

export class Organization1746779368405 implements MigrationInterface {
  name = 'Organization1746779368405'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "organization" ("id" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" text NOT NULL, "image" text, "seats" smallint NOT NULL DEFAULT '1', "subscriptionFlags" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_organization_organization_id" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS IDX_organization_subflags_subscriptionid ON "organization" (("subscriptionFlags"->>'subscriptionId'))`);
    await queryRunner.query(`ALTER TABLE "content_preference" ADD "organizationId" text`);
    await queryRunner.query(`ALTER TABLE "content_preference" ADD CONSTRAINT "FK_content_preference_organization_id" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_content_preference_organization_id" ON "content_preference" ("organizationId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_content_preference_organization_id"`);
    await queryRunner.query(`ALTER TABLE "content_preference" DROP CONSTRAINT "FK_content_preference_organization_id"`);
    await queryRunner.query(`ALTER TABLE "content_preference" DROP COLUMN "organizationId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_organization_subflags_subscriptionid"`);
    await queryRunner.query(`DROP TABLE "organization"`);
  }
}

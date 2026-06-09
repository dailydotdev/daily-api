import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContributionUiSupport1780987130989 implements MigrationInterface {
  name = 'AddContributionUiSupport1780987130989';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "contribution_sponsor" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "name" text NOT NULL,
        "amountCents" integer NOT NULL,
        "url" text,
        "logoUrl" text,
        "active" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_contribution_sponsor_id"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_contribution_sponsor_active_sort"
        ON "contribution_sponsor" ("active", "sortOrder", "createdAt")
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_action"
        ADD "metadata" jsonb NOT NULL DEFAULT '{}'
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_cause"
        ADD "description" text
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_cause"
        ADD "category" text
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_cause"
        ADD "logoUrl" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_cause"
        DROP COLUMN "logoUrl"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_cause"
        DROP COLUMN "category"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_cause"
        DROP COLUMN "description"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_action"
        DROP COLUMN "metadata"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "contribution_sponsor"
    `);
  }
}

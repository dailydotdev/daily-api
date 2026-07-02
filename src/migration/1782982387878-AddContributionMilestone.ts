import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContributionMilestone1782982387878
  implements MigrationInterface
{
  name = 'AddContributionMilestone1782982387878';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "contribution_milestone" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "value" integer NOT NULL,
        "title" text,
        "reachedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_contribution_milestone_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_contribution_milestone_value"
        ON "contribution_milestone" ("value")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_contribution_milestone_value"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "contribution_milestone"`);
  }
}

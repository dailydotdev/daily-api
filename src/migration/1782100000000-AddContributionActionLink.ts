import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContributionActionLink1782100000000
  implements MigrationInterface
{
  name = 'AddContributionActionLink1782100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "contribution_action_link" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "actionId" uuid NOT NULL,
        "url" text NOT NULL,
        "label" text,
        "active" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT '0',
        CONSTRAINT "PK_contribution_action_link_id"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_contribution_action_link_action_active"
        ON "contribution_action_link" ("actionId", "active", "sortOrder")
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_action_link"
        ADD CONSTRAINT "FK_contribution_action_link_action_id"
        FOREIGN KEY ("actionId")
        REFERENCES "contribution_action"("id")
        ON DELETE CASCADE
        ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "contribution_action_link"
        DROP CONSTRAINT "FK_contribution_action_link_action_id"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_contribution_action_link_action_active"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "contribution_action_link"
    `);
  }
}

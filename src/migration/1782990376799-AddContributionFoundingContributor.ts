import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContributionFoundingContributor1782990376799
  implements MigrationInterface
{
  name = 'AddContributionFoundingContributor1782990376799';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "contribution_founding_contributor" (
        "userId" character varying(36) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "transactionId" uuid,
        CONSTRAINT "PK_contribution_founding_contributor" PRIMARY KEY ("userId")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_founding_contributor"
        ADD CONSTRAINT "FK_contribution_founding_contributor_user_id"
        FOREIGN KEY ("userId") REFERENCES "user"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contribution_founding_contributor"
        DROP CONSTRAINT IF EXISTS "FK_contribution_founding_contributor_user_id"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "contribution_founding_contributor"`,
    );
  }
}

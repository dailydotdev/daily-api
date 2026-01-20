import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClaimableItemIdentifier1768937354866 implements MigrationInterface {
  name = 'ClaimableItemIdentifier1768937354866';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_claimable_item_email"`);
    await queryRunner.query(
      `ALTER TABLE "claimable_item" RENAME COLUMN "email" TO "identifier"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_claimable_item_identifier" ON "claimable_item" ("identifier") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_claimable_item_identifier"`,
    );
    await queryRunner.query(
      `ALTER TABLE "claimable_item" RENAME COLUMN "identifier" TO "email"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_claimable_item_email" ON "claimable_item" ("email") `,
    );
  }
}

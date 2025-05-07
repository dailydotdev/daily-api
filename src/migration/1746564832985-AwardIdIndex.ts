import { MigrationInterface, QueryRunner } from 'typeorm';

export class AwardIdIndex1746564832985 implements MigrationInterface {
  name = 'AwardIdIndex1746564832985';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_post_flags_awardId" ON "user_post" (("flags"->>'awardId'))`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_comment_flags_awardId" ON "user_comment" (("flags"->>'awardId'))`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_product_value_desc" ON product ("value" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_product_value_desc"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_user_comment_flags_awardId"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_user_post_flags_awardId"`,
    );
  }
}

import { MigrationInterface, QueryRunner } from "typeorm";

export class KeywordIndicies1758101598623 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_keyword_value_trgm_allow_synonym"
        ON "public"."keyword"
        USING gin (value gin_trgm_ops)
        WHERE status IN ('allow', 'synonym')
    `);
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_keyword_status_occ_value"
        ON "public"."keyword" ("status", "occurrences" DESC, "value" ASC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      DROP INDEX IF EXISTS "IDX_keyword_status_occ_value"
    `);
    await queryRunner.query(/* sql */`
      DROP INDEX IF EXISTS "IDX_keyword_value_trgm_allow_synonym"
    `);
  }
}

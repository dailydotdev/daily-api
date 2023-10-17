import { MigrationInterface, QueryRunner } from "typeorm";

export class KeywordFlags1697546410147 implements MigrationInterface {
    name = 'KeywordFlags1697546410147'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "keyword" ADD "flags" jsonb NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`CREATE INDEX "IDX_keyword_flags_onboarding" ON post USING HASH (((flags->'onboarding')::boolean))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`DROP INDEX "IDX_keyword_flags_onboarding"`);
        await queryRunner.query(`ALTER TABLE "keyword" DROP COLUMN "flags"`);
    }

}

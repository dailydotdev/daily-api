import { MigrationInterface, QueryRunner } from "typeorm";

export class OnboardingTagsIndex1698230451545 implements MigrationInterface {
    name = 'OnboardingTagsIndex1698230451545'

    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`DROP INDEX "IDX_keyword_flags_onboarding"`);
      await queryRunner.query(`CREATE INDEX "IDX_keyword_flags_onboarding_value" ON keyword (((flags->'onboarding')::boolean), "value")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`DROP INDEX "IDX_keyword_flags_onboarding_value"`);
      await queryRunner.query(`CREATE INDEX "IDX_keyword_flags_onboarding" ON post USING HASH (((flags->'onboarding')::boolean))`);
    }

}

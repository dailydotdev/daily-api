import { MigrationInterface, QueryRunner } from "typeorm";

export class OnboardingTagsTextIndex1698323453474 implements MigrationInterface {
    name = 'OnboardingTagsTextIndex1698323453474'

    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`DROP INDEX "IDX_keyword_flags_onboarding_value"`);
      await queryRunner.query(`CREATE INDEX "IDX_keyword_flags_onboarding_value_text" ON keyword ((flags->'onboarding'), "value")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`DROP INDEX "IDX_keyword_flags_onboarding_value_text"`);
      await queryRunner.query(`CREATE INDEX "IDX_keyword_flags_onboarding_value" ON keyword (((flags->'onboarding')::boolean), "value")`);
    }

}

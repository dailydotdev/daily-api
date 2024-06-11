import { MigrationInterface, QueryRunner } from "typeorm";

export class OnboardingChecklistSetting1718116498943 implements MigrationInterface {
    name = 'OnboardingChecklistSetting1718116498943'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" ADD "onboardingChecklistView" text NOT NULL DEFAULT 'hidden'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "onboardingChecklistView"`);
    }

}

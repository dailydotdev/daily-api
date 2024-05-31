import { MigrationInterface, QueryRunner } from "typeorm";

export class OptOutReadingStreak1717144015912 implements MigrationInterface {
    name = 'OptOutReadingStreak1717144015912'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" ADD "optOutReadingStreak" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "optOutReadingStreak"`);
    }

}

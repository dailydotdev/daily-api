import { MigrationInterface, QueryRunner } from "typeorm";

export class FeedSettingsBlocked1721377128858 implements MigrationInterface {
    name = 'FeedSettingsBlocked1721377128858'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "feed_source" ADD "blocked" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "feed_source" DROP COLUMN "blocked"`);
    }
}

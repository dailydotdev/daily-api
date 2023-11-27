import { MigrationInterface, QueryRunner } from "typeorm";

export class YouTubePost1700735236452 implements MigrationInterface {
    name = 'YouTubePost1700735236452'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" ADD "videoId" text`);
        await queryRunner.query(`ALTER TABLE "advanced_settings" ADD "group" text NOT NULL DEFAULT 'advanced'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "videoId"`);
        await queryRunner.query(`ALTER TABLE "advanced_settings" DROP COLUMN "group"`);
    }
}

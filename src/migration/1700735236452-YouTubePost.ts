import { MigrationInterface, QueryRunner } from "typeorm";

export class YouTubePost1700735236452 implements MigrationInterface {
    name = 'YouTubePost1700735236452'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" ADD "video_id" text`);
        await queryRunner.query(`ALTER TABLE "advanced_settings" ADD "group" text NOT NULL DEFAULT 'advanced'`);
        await queryRunner.query(`ALTER TABLE "advanced_settings" ALTER COLUMN "group" DROP DEFAULT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "video_id"`);
        await queryRunner.query(`ALTER TABLE "advanced_settings" DROP COLUMN "group"`);
    }
}

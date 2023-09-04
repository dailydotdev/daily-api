import { MigrationInterface, QueryRunner } from "typeorm";

export class SourceImageDefault1693820674317 implements MigrationInterface {
    name = 'SourceImageDefault1693820674317'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "source" ALTER COLUMN "image" SET DEFAULT 'https://daily-now-res.cloudinary.com/image/upload/s--LrHsyt2T--/f_auto/v1692632054/squad_placeholder_sfwkmj'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "source" ALTER COLUMN "image" SET DEFAULT 'https://daily-now-res.cloudinary.com/image/upload/v1672041320/squads/squad_placeholder.jpg'`);
    }

}

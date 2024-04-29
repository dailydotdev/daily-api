import { MigrationInterface, QueryRunner } from "typeorm";

export class PostContentQuality1714395908762 implements MigrationInterface {
    name = 'PostContentQuality1714395908762'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" ADD "contentQuality" jsonb NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "contentQuality"`);
    }

}

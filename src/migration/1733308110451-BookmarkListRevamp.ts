import { MigrationInterface, QueryRunner } from "typeorm";

export class BookmarkListRevamp1733308110451 implements MigrationInterface {
    name = 'BookmarkListRevamp1733308110451'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bookmark_list" ADD "icon" text`);
        await queryRunner.query(`ALTER TABLE "bookmark_list" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "bookmark_list" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bookmark_list" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "bookmark_list" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "bookmark_list" DROP COLUMN "icon"`);
    }
}

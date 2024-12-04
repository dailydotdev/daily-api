import { MigrationInterface, QueryRunner } from "typeorm";

export class BookmarkListRevamp1733312873990 implements MigrationInterface {
    name = 'BookmarkListRevamp1733312873990'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bookmark" DROP CONSTRAINT "FK_5a7c74084b06b4a08961de754cd"`);
        await queryRunner.query(`ALTER TABLE "bookmark_list" ADD "icon" text`);
        await queryRunner.query(`ALTER TABLE "bookmark_list" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "bookmark_list" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "bookmark" ADD CONSTRAINT "FK_7eb405db4d1a4af2d26e7c8231d" FOREIGN KEY ("listId") REFERENCES "bookmark_list"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bookmark" DROP CONSTRAINT "FK_7eb405db4d1a4af2d26e7c8231d"`);
        await queryRunner.query(`ALTER TABLE "bookmark_list" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "bookmark_list" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "bookmark_list" DROP COLUMN "icon"`);
        await queryRunner.query(`ALTER TABLE "bookmark" ADD CONSTRAINT "FK_5a7c74084b06b4a08961de754cd" FOREIGN KEY ("listId") REFERENCES "bookmark_list"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }
}

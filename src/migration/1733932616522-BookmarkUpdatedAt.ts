import { MigrationInterface, QueryRunner } from "typeorm";

export class BookmarkUpdatedAt1733932616522 implements MigrationInterface {
    name = 'BookmarkUpdatedAt1733932616522'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bookmark" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`CREATE INDEX "IDX_bookmark_updatedAt" ON "bookmark" ("updatedAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bookmark" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`DROP INDEX IF EXIST "IDX_bookmark_updatedAt"`);
    }

}

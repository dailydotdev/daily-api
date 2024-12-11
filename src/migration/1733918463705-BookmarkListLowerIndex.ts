import { MigrationInterface, QueryRunner } from "typeorm";

export class BookmarkListLowerIndex1733918463705 implements MigrationInterface {
    name = 'BookmarkListLowerIndex1733918463705'

    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(
        `CREATE INDEX "bookmark_list_idx_lowername_asc" ON "bookmark_list" (LOWER(name) ASC)`,
      );
    }
    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`DROP INDEX "bookmark_list_idx_lowername_asc"`);
    }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class BookmarkSlug1643634601290 implements MigrationInterface {
  name = 'BookmarkSlug1643634601290';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "settings"
      ADD "bookmarkSlug" uuid`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_settings_bookmarkslug" ON "settings" ("bookmarkSlug") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_settings_bookmarkslug"`);
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "bookmarkSlug"`,
    );
  }
}

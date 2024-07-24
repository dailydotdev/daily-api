import { MigrationInterface, QueryRunner } from 'typeorm';

export class BookmarkRemindAtPrecision1721828469846
  implements MigrationInterface
{
  name = 'BookmarkRemindAtPrecision1721828469846';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookmark" ALTER COLUMN "remindAt" TYPE TIMESTAMP(3)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookmark" ALTER COLUMN "remindAt" TYPE TIMESTAMP(6)`,
    );
  }
}

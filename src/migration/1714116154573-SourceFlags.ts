import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceFlags1714116154573 implements MigrationInterface {
  name = 'SourceFlags1714116154573';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source" ADD "flags" jsonb NOT NULL DEFAULT '{"totalPosts":0,"totalViews":0,"totalUpvotes":0}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "flags"`);
  }
}

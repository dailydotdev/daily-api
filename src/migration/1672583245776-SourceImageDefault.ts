import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceImageDefault1672583245776 implements MigrationInterface {
  name = 'SourceImageDefault1672583245776';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source"
      ALTER COLUMN "image" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "source"
      ALTER COLUMN "image" SET DEFAULT 'https://daily-now-res.cloudinary.com/image/upload/s--LrHsyt2T--/f_auto/v1692632054/squad_placeholder_sfwkmj'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source"
      ALTER COLUMN "image" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "source"
      ALTER COLUMN "image" DROP NOT NULL`);
  }
}

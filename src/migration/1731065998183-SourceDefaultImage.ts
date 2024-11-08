import { MigrationInterface, QueryRunner } from "typeorm";

export class SourceDefaultImage1731065998183 implements MigrationInterface {
  name = 'SourceDefaultImage1731065998183'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source" ALTER COLUMN "image" SET DEFAULT 'https://media.daily.dev/image/upload/s--LrHsyt2T--/f_auto/v1692632054/squad_placeholder_sfwkmj'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source" ALTER COLUMN "image" SET DEFAULT 'https://daily-now-res.cloudinary.com/image/upload/s--LrHsyt2T--/f_auto/v1692632054/squad_placeholder_sfwkmj'`);
  }
}

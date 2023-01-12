import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceImageDefault1672583245776 implements MigrationInterface {
  name = 'SourceImageDefault1672583245776';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source"
      ALTER COLUMN "image" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "source"
      ALTER COLUMN "image" SET DEFAULT 'https://daily-now-res.cloudinary.com/image/upload/v1672041320/squads/squad_placeholder.jpg'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source"
      ALTER COLUMN "image" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "source"
      ALTER COLUMN "image" DROP NOT NULL`);
  }
}

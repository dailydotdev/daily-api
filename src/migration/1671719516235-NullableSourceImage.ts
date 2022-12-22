import { MigrationInterface, QueryRunner } from 'typeorm';

export class NullableSourceImage1671719516235 implements MigrationInterface {
  name = 'NullableSourceImage1671719516235';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source"
      ALTER COLUMN "image" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source"
      ALTER COLUMN "image" SET NOT NULL`);
  }
}

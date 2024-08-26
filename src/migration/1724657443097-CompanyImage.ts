import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyImage1724657443097 implements MigrationInterface {
  name = 'CompanyImage1724657443097';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company" ALTER COLUMN "image" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company" ALTER COLUMN "image" DROP NOT NULL`,
    );
  }
}

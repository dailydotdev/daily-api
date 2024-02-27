import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserAcquisitionChannel1709002546321 implements MigrationInterface {
  name = 'UserAcquisitionChannel1709002546321';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "acquisitionChannel" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "acquisitionChannel"`,
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserLocationId1760354446019 implements MigrationInterface {
  name = 'UserLocationId1760354446019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "locationId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_user_locationId" FOREIGN KEY ("locationId") REFERENCES "dataset_location"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_locationId" ON "user" ("locationId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_user_locationId"`);
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "FK_user_locationId"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "locationId"`);
  }
}

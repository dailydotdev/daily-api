import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserDefaultFeed1733987625520 implements MigrationInterface {
  name = 'UserDefaultFeed1733987625520';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "defaultFeedId" text`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_ff0f49b797aca629f81cef47610" UNIQUE ("defaultFeedId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_ff0f49b797aca629f81cef47610" FOREIGN KEY ("defaultFeedId") REFERENCES "feed"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "FK_ff0f49b797aca629f81cef47610"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "UQ_ff0f49b797aca629f81cef47610"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "defaultFeedId"`);
  }
}

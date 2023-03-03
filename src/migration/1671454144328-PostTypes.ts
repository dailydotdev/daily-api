import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostTypes1671454144328 implements MigrationInterface {
  name = 'PostTypes1671454144328';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post"
      ADD "sharedPostId" text`);
    await queryRunner.query(`ALTER TABLE "post"
      ADD "type" character varying NOT NULL DEFAULT 'article'`);
    await queryRunner.query(`ALTER TABLE "post"
      ALTER COLUMN "sourceId" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "post"
      ALTER COLUMN "url" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "post"
      ADD CONSTRAINT "FK_0e7cbc85b452229a89e3c551720" FOREIGN KEY ("sharedPostId") REFERENCES "post" ("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" DROP CONSTRAINT "FK_0e7cbc85b452229a89e3c551720"`,
    );
    await queryRunner.query(`ALTER TABLE "post"
      ALTER COLUMN "url" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "post"
      ALTER COLUMN "sourceId" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "type"`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "sharedPostId"`);
  }
}

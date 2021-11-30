import { MigrationInterface, QueryRunner } from 'typeorm';

export class HTMLComments1637823009822 implements MigrationInterface {
  name = 'HTMLComments1637823009822';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."comment" ADD "contentHtml" text NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."comment" DROP COLUMN "contentHtml"`,
    );
  }
}

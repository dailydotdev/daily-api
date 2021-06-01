import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisplayPropsToSource1622476886845
  implements MigrationInterface {
  name = 'AddDisplayPropsToSource1622476886845';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "public"."source" ADD "name" text`);
    await queryRunner.query(`ALTER TABLE "public"."source" ADD "image" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."source" DROP COLUMN "image"`,
    );
    await queryRunner.query(`ALTER TABLE "public"."source" DROP COLUMN "name"`);
  }
}

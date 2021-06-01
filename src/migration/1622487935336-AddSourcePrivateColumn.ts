import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSourcePrivateColumn1622487935336 implements MigrationInterface {
  name = 'AddSourcePrivateColumn1622487935336';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."source" ADD "private" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."source" ALTER COLUMN "name" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."source" ALTER COLUMN "image" SET NOT NULL`,
    );
    await queryRunner.query(
      `update "public"."source" set private = true, active = false where not exists (select * from source_display sd where source.id = sd."sourceId" and sd."userId" is null)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."source" ALTER COLUMN "image" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."source" ALTER COLUMN "name" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."source" DROP COLUMN "private"`,
    );
  }
}

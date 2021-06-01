import { MigrationInterface, QueryRunner } from 'typeorm';

export class FillSourceNameAndImage1622483114702 implements MigrationInterface {
  name = 'FillSourceNameAndImage1622483114702';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."post_report" ADD CONSTRAINT "FK_d1d5a13218f895570f4d7ad5897" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `update "source" set "name" = sd."name", "image" = sd."image" from (select *, row_number() over (partition by sd."sourceId" order by "userId" desc nulls first) as row_number from source_display sd) as sd where "source".id = sd."sourceId" and sd.row_number = 1;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."post_report" DROP CONSTRAINT "FK_d1d5a13218f895570f4d7ad5897"`,
    );
    await queryRunner.query(
      `update "source" set "name" = null, "image" = null`,
    );
  }
}

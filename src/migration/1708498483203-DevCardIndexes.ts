import { MigrationInterface, QueryRunner } from 'typeorm';

export class DevCardIndexes1708498483203 implements MigrationInterface {
  name = 'DevCardIndexes1708498483203';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_post_id_sourceid" ON "post" ("id", "sourceId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_activ_priva_id_img_name_handl" ON "source" ("active", "private", "id", "image", "name", "handle") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_post_id_sourceid"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_source_activ_priva_id_img_name_handl"`,
    );
  }
}

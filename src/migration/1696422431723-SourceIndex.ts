import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceIndex1696422431723 implements MigrationInterface {
  name = 'SourceIndex1696422431723';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_source_active_private_image" ON "source" ("active", "private", "image") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_source_active_private_image"`,
    );
  }
}

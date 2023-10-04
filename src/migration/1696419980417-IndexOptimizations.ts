import { MigrationInterface, QueryRunner } from 'typeorm';

export class IndexOptimizations1696419980417 implements MigrationInterface {
  name = 'IndexOptimizations1696419980417';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX source_idx_active_private_image ON "public"."source" ("active","private","image")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX source_idx_active_private_image`);
  }
}

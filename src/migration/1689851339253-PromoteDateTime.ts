import { MigrationInterface, QueryRunner } from 'typeorm';

export class PromoteDateTime1689851339253 implements MigrationInterface {
  name = 'PromoteDateTime1689851339253';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_post_flags_promoteToPublic"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_post_flags_promoteToPublic" ON post USING BTREE (((flags->>'promoteToPublic')::integer))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_post_flags_promoteToPublic"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_post_flags_promoteToPublic" ON post USING HASH (((flags->'promoteToPublic')::boolean))`,
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceMembersIndex1725988464760 implements MigrationInterface {
  name = 'SourceMembersIndex1725988464760';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_source_flags_total_members" ON post USING HASH (((flags->'totalMembers')::integer))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_source_flags_total_members"`);
  }
}

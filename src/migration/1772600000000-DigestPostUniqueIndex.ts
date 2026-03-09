import { MigrationInterface, QueryRunner } from 'typeorm';

export class DigestPostUniqueIndex1772600000000 implements MigrationInterface {
  name = 'DigestPostUniqueIndex1772600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_post_authorId_sourceId_digest"
        ON "post" ("authorId", "sourceId")
        WHERE "type" = 'digest'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_post_authorId_sourceId_digest"`,
    );
  }
}

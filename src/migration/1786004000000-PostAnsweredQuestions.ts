import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostAnsweredQuestions1786004000000 implements MigrationInterface {
  name = 'PostAnsweredQuestions1786004000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nullable with no default, so this is a catalog-only change on PG 11+ and the
    // 3.7M row heap is never rewritten. NULL means "never enriched", [] means
    // "enriched and nothing was worth asking".
    await queryRunner.query(`ALTER TABLE "post" ADD "answeredQuestions" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" DROP COLUMN "answeredQuestions"`,
    );
  }
}

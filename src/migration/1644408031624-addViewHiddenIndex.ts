import { MigrationInterface, QueryRunner } from 'typeorm';

export class addViewHiddenIndex1644408031624 implements MigrationInterface {
  name = 'addViewHiddenIndex1644408031624';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_a91d81ad0de50fab4688a665c1" ON "view" ("postId", "userId", "hidden") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a91d81ad0de50fab4688a665c1"`,
    );
  }
}

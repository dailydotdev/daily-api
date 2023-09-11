import { MigrationInterface, QueryRunner } from 'typeorm';

export class ViewIndex1694443626041 implements MigrationInterface {
  name = 'ViewIndex1694443626041';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_3aaca4c7b6bd877a50443bed34" ON "view" ("userId", "timestamp") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3aaca4c7b6bd877a50443bed34"`,
    );
  }
}

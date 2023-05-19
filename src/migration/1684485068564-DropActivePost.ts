import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropActivePost1684485068564 implements MigrationInterface {
  name = 'DropActivePost1684485068564';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW "active_post"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE VIEW "active_post" AS SELECT p.* FROM "public"."post" "p" WHERE "p"."deleted" = false AND "p"."visible" = true`,
    );
  }
}

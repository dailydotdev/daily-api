import { MigrationInterface, QueryRunner } from 'typeorm';

export class OpenSidebarSettings1638431396006 implements MigrationInterface {
  name = 'OpenSidebarSettings1638431396006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."settings" ADD "openSidebar" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."settings" DROP COLUMN "openSidebar"`,
    );
  }
}

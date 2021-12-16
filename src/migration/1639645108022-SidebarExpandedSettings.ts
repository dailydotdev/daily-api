import { MigrationInterface, QueryRunner } from 'typeorm';

export class SidebarExpandedSettings1639645108022
  implements MigrationInterface
{
  name = 'SidebarExpandedSettings1639645108022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."settings" RENAME COLUMN "openSidebar" TO "sidebarExpanded"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."settings" RENAME COLUMN "sidebarExpanded" TO "openSidebar"`,
    );
  }
}

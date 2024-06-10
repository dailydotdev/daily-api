import { MigrationInterface, QueryRunner } from "typeorm";

export class SidebarExpanded1718023112446 implements MigrationInterface {
    name = 'SidebarExpanded1718023112446'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" ALTER COLUMN "sidebarExpanded" SET DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" ALTER COLUMN "sidebarExpanded" SET DEFAULT true`);
    }

}

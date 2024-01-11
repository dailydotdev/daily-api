import { MigrationInterface, QueryRunner } from "typeorm";

export class GhostUserProtect1704948666033 implements MigrationInterface {
    name = 'GhostUserProtect1704948666033'

    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`CREATE RULE prototect_ghostuser_deletion AS ON DELETE TO "user" WHERE old.id IN ('404') DO INSTEAD nothing;`);
      await queryRunner.query(`CREATE RULE prototect_ghostuser_update AS ON UPDATE TO "user" WHERE old.id IN ('404') DO INSTEAD nothing;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`DROP RULE prototect_ghostuser_deletion on "user";`);
      await queryRunner.query(`DROP RULE prototect_ghostuser_update on "user";`);
    }
}

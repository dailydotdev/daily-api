import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameInactiveUser1704973835929 implements MigrationInterface {
    name = 'RenameInactiveUser1704973835929'

    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`UPDATE "public"."user" SET "name" = 'Deleted user', "username" = 'ghost' WHERE "id" = '404';`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`UPDATE "public"."user" SET "name" = 'Inactive user', "username" = 'inactive_user' WHERE "id" = '404';`);
    }
}

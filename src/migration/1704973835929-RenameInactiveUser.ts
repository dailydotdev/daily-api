import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameInactiveUser1704973835929 implements MigrationInterface {
    name = 'RenameInactiveUser1704973835929'

    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`UPDATE "public"."user" SET "name" = 'Deleted user', "username" = 'ghost', "image" = 'https://daily-now-res.cloudinary.com/image/upload/s--hNIUzLiO--/f_auto/v1705327420/public/ghost_vlftth' WHERE "id" = '404';`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`UPDATE "public"."user" SET "name" = 'Inactive user', "username" = 'inactive_user', "image" = 'https://daily-now-res.cloudinary.com/image/upload/f_auto,q_auto/placeholders/placeholder3' WHERE "id" = '404';`);
    }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class DummyUser1683721525235 implements MigrationInterface {
  name = 'DummyUser1683721525235';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "public"."user" ("id", "name", "image", "username") VALUES ('404', 'Inactive user', 'https://daily-now-res.cloudinary.com/image/upload/f_auto,q_auto/placeholders/placeholder3', 'inactive_user')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "public"."user" where id = "404"`);
  }
}

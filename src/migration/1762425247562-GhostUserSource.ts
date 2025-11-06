import { MigrationInterface, QueryRunner } from "typeorm";
import { ghostUser } from "../common";

export class GhostUserSource1762425247562 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      INSERT INTO "public"."source" (
        "id",
        "name",
        "image",
        "handle",
        "type",
        "userId"
      )
      VALUES (
        '${ghostUser.id}',
        '${ghostUser.name}',
        '${ghostUser.image}',
        '${ghostUser.id}',
        'user',
        '${ghostUser.id}'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DELETE FROM "public"."source"
        WHERE "id" = '${ghostUser.id}'
    `);
  }
}

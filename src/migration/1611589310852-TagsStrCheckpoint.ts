import {MigrationInterface, QueryRunner} from "typeorm";

export class TagsStrCheckpoint1611589310852 implements MigrationInterface {
    name = 'TagsStrCheckpoint1611589310852'

    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`INSERT INTO "public"."checkpoint" ("key", "timestamp") VALUES ('last_tags_str_update', now())`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`DELETE FROM "public"."checkpoint" WHERE "key" = 'last_tags_str_update'`)
    }

}

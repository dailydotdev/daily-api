import {MigrationInterface, QueryRunner} from "typeorm";

export class Integration1591621000530 implements MigrationInterface {
    name = 'Integration1591621000530'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "public"."integration" ("timestamp" TIMESTAMP NOT NULL DEFAULT now(), "logo" text NOT NULL, "title" text NOT NULL, "subtitle" text NOT NULL, "url" text NOT NULL, CONSTRAINT "PK_32512f32a4d191de7b64373ff5f" PRIMARY KEY ("timestamp"))`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "public"."integration"`, undefined);
    }

}

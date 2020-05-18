import {MigrationInterface, QueryRunner} from "typeorm";

export class Banner1589812598274 implements MigrationInterface {
    name = 'Banner1589812598274'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "public"."banner" ("timestamp" TIMESTAMP NOT NULL DEFAULT now(), "title" text NOT NULL, "subtitle" text NOT NULL, "cta" text NOT NULL, "url" text NOT NULL, "theme" text NOT NULL, CONSTRAINT "PK_2964edc0a2e737dd174e32a5446" PRIMARY KEY ("timestamp"))`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "public"."banner"`, undefined);
    }

}

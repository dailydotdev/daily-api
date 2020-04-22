import {MigrationInterface, QueryRunner} from "typeorm";

export class Notification1587564396149 implements MigrationInterface {
    name = 'Notification1587564396149'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "public"."notification" ("timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, "html" text NOT NULL, CONSTRAINT "PK_aaea7d16887fb591ff6228131aa" PRIMARY KEY ("timestamp"))`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "public"."notification"`, undefined);
    }

}

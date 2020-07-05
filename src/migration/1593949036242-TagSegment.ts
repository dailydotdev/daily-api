import {MigrationInterface, QueryRunner} from "typeorm";

export class TagSegment1593949036242 implements MigrationInterface {
    name = 'TagSegment1593949036242'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "public"."tag_segment" ("tag" text NOT NULL, "segment" text NOT NULL, CONSTRAINT "PK_003b5e5f5273d6ef55d7d24a797" PRIMARY KEY ("tag"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_434222b69243c6c160201e8841" ON "public"."tag_segment" ("segment") `, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_434222b69243c6c160201e8841"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."tag_segment"`, undefined);
    }

}

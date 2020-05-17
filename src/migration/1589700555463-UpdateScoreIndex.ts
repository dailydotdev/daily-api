import {MigrationInterface, QueryRunner} from "typeorm";

export class UpdateScoreIndex1589700555463 implements MigrationInterface {
    name = 'UpdateScoreIndex1589700555463'

    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`DROP INDEX "public"."IDX_post_score"`, undefined);
      await queryRunner.query(`CREATE INDEX "IDX_post_score" ON "public"."post" ("score" DESC) `, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`DROP INDEX "public"."IDX_post_score"`, undefined);
      await queryRunner.query(`CREATE INDEX "IDX_post_score" ON "public"."post" ("score") `, undefined);
    }

}

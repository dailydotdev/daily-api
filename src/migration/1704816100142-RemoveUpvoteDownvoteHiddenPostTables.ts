import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveUpvoteDownvoteHiddenPostTables1704816100142 implements MigrationInterface {
    name = 'RemoveUpvoteDownvoteHiddenPostTables1704816100142'

    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`DROP TABLE "upvote"`);
      await queryRunner.query(`DROP TABLE "downvote"`);
      await queryRunner.query(`DROP TABLE "hidden_post"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}

}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostMentionEntity1683523942931 implements MigrationInterface {
  name = 'PostMentionEntity1683523942931';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "post_mention" ("postId" character varying(14) NOT NULL, "mentionedByUserId" character varying(36) NOT NULL, "mentionedUserId" character varying(36) NOT NULL, CONSTRAINT "PK_36d21500cf18ea0e76c661ca32f" PRIMARY KEY ("postId", "mentionedByUserId", "mentionedUserId"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "post_mention"`);
  }
}

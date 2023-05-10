import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostMentionEntity1683690019569 implements MigrationInterface {
  name = 'PostMentionEntity1683690019569';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "post_mention" ("postId" text NOT NULL, "mentionedByUserId" character varying(36) NOT NULL, "mentionedUserId" character varying(36) NOT NULL, CONSTRAINT "PK_36d21500cf18ea0e76c661ca32f" PRIMARY KEY ("postId", "mentionedByUserId", "mentionedUserId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_mention" ADD CONSTRAINT "FK_2a31e87a2a08355c43fc87de547" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_mention" ADD CONSTRAINT "FK_e41f5df92c3048b9d242b8e1a51" FOREIGN KEY ("mentionedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_mention" ADD CONSTRAINT "FK_6bffe5dffe26a589d67af08343c" FOREIGN KEY ("mentionedUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post_mention" DROP CONSTRAINT "FK_6bffe5dffe26a589d67af08343c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_mention" DROP CONSTRAINT "FK_e41f5df92c3048b9d242b8e1a51"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_mention" DROP CONSTRAINT "FK_2a31e87a2a08355c43fc87de547"`,
    );
    await queryRunner.query(`DROP TABLE "post_mention"`);
  }
}

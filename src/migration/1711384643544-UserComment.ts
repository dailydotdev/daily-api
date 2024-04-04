import { MigrationInterface, QueryRunner } from "typeorm";

export class UserComment1711384643544 implements MigrationInterface {
    name = 'UserComment1711384643544'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_comment" ("commentId" character varying NOT NULL, "userId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "votedAt" TIMESTAMP, "vote" smallint NOT NULL DEFAULT '0', "flags" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_9c7d2a40fc3deac4d66155997c3" PRIMARY KEY ("commentId", "userId"))`);
        await queryRunner.query(`ALTER TABLE "user_comment" REPLICA IDENTITY FULL`);
        await queryRunner.query(`CREATE INDEX "IDX_d2ac5b050de3eea850124fa24c" ON "user_comment" ("userId", "vote", "votedAt")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9c7d2a40fc3deac4d66155997c" ON "user_comment" ("commentId", "userId")`);
        await queryRunner.query(`ALTER TABLE "user_comment" ADD CONSTRAINT "FK_b7d2dcc1d8826d4ef2fc5716bf4" FOREIGN KEY ("commentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_comment" ADD CONSTRAINT "FK_ebd475b57b16b0039934dc31a14" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION comment_voted_at_time()
              RETURNS TRIGGER
              LANGUAGE PLPGSQL
              AS
            $$
            BEGIN
              NEW."votedAt" = now();
              RETURN NEW;
            END;
            $$
        `)
        await queryRunner.query('CREATE TRIGGER comment_voted_insert_trigger BEFORE INSERT ON "user_comment" FOR EACH ROW WHEN (NEW.vote != 0) EXECUTE PROCEDURE comment_voted_at_time()')
        await queryRunner.query('CREATE TRIGGER comment_voted_update_trigger BEFORE UPDATE ON "user_comment" FOR EACH ROW WHEN (OLD.vote IS DISTINCT FROM NEW.vote) EXECUTE PROCEDURE comment_voted_at_time()')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TRIGGER IF EXISTS comment_voted_update_trigger ON "user_comment"')
        await queryRunner.query('DROP TRIGGER IF EXISTS comment_voted_insert_trigger ON "user_comment"')
        await queryRunner.query('DROP FUNCTION IF EXISTS comment_voted_at_time')

        await queryRunner.query(`ALTER TABLE "user_comment" DROP CONSTRAINT "FK_ebd475b57b16b0039934dc31a14"`);
        await queryRunner.query(`ALTER TABLE "user_comment" DROP CONSTRAINT "FK_b7d2dcc1d8826d4ef2fc5716bf4"`);
        await queryRunner.query(`DROP TABLE "user_comment"`);
    }

}

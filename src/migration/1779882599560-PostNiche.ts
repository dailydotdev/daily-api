import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PostNiche1779882599560 implements MigrationInterface {
  name = 'PostNiche1779882599560';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "post_niche" (
        "postId" text NOT NULL,
        "nicheId" uuid NOT NULL,
        "rank" smallint NOT NULL,
        "score" real,
        "computedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_niche" PRIMARY KEY ("postId", "nicheId"),
        CONSTRAINT "UQ_post_niche_rank" UNIQUE ("postId", "rank"),
        CONSTRAINT "CHK_post_niche_rank"
          CHECK ("rank" BETWEEN 1 AND 2),
        CONSTRAINT "FK_post_niche_post"
          FOREIGN KEY ("postId") REFERENCES "post"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_post_niche_niche"
          FOREIGN KEY ("nicheId") REFERENCES "niche"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX "IDX_post_niche_niche_rank"
        ON "post_niche" ("nicheId", "rank")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "post_niche"`);
  }
}

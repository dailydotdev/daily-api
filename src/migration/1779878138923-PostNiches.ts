import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PostNiches1779878138923 implements MigrationInterface {
  name = 'PostNiches1779878138923';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "niche" (
        "id" text NOT NULL,
        "title" text NOT NULL,
        "bucketGroup" text NOT NULL DEFAULT 'theme',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_niche_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_niche_bucketGroup"
          CHECK ("bucketGroup" IN ('ecosystem','theme'))
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "keyword_niche" (
        "keyword" text NOT NULL,
        "primaryNicheId" text NOT NULL,
        "secondaryNicheId" text,
        "weightMultiplier" real NOT NULL DEFAULT 1,
        "confidence" smallint NOT NULL DEFAULT 2,
        "labelerVersion" text,
        "labeledAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_keyword_niche_keyword" PRIMARY KEY ("keyword"),
        CONSTRAINT "CHK_keyword_niche_confidence"
          CHECK ("confidence" BETWEEN 1 AND 3),
        CONSTRAINT "CHK_keyword_niche_primary_neq_secondary"
          CHECK ("secondaryNicheId" IS NULL
                 OR "secondaryNicheId" <> "primaryNicheId"),
        CONSTRAINT "FK_keyword_niche_keyword"
          FOREIGN KEY ("keyword") REFERENCES "keyword"("value")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_keyword_niche_primary"
          FOREIGN KEY ("primaryNicheId") REFERENCES "niche"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_keyword_niche_secondary"
          FOREIGN KEY ("secondaryNicheId") REFERENCES "niche"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX "IDX_keyword_niche_primary"
        ON "keyword_niche" ("primaryNicheId")
    `);
    await queryRunner.query(/* sql */ `
      CREATE INDEX "IDX_keyword_niche_secondary"
        ON "keyword_niche" ("secondaryNicheId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "keyword_niche"`);
    await queryRunner.query(`DROP TABLE "niche"`);
  }
}

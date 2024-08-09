import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceCategory1723118739478 implements MigrationInterface {
  name = 'SourceCategory1723118739478';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "source_category" ("id" text NOT NULL, "value" text NOT NULL, "enabled" boolean NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_f130e0bac7dea92c2a4084c2f89" UNIQUE ("value"), CONSTRAINT "PK_21e4d5359f2a23fd10053f516e9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "source" ADD "categoryId" text`);
    await queryRunner.query(
      `ALTER TABLE "source" ADD CONSTRAINT "FK_02e1cbb6e33fa90e68dd56de2a9" FOREIGN KEY ("categoryId") REFERENCES "source_category"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`
      INSERT INTO "source_category"
      (id, value, enabled)
      VALUES
      ('general', 'General', true),
      ('web', 'Web', true),
      ('mobile', 'Mobile', true),
      ('games', 'Games', true),
      ('devops', 'DevOps', true),
      ('cloud', 'Cloud', true),
      ('career', 'Career', true),
      ('data', 'Data', true),
      ('fun', 'Fun', true),
      ('devtools', 'DevTools', true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`TRUNCATE "source_category"`);
    await queryRunner.query(
      `ALTER TABLE "source" DROP CONSTRAINT "FK_02e1cbb6e33fa90e68dd56de2a9"`,
    );
    await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "categoryId"`);
    await queryRunner.query(`DROP TABLE "source_category"`);
  }
}

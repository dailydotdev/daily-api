import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExperimentVariant1743605489726 implements MigrationInterface {
  name = 'ExperimentVariant1743605489726';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "experiment_variant" ("feature" text NOT NULL, "variant" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "value" text, CONSTRAINT "PK_7ad1025f0a1a8674a557253db8e" PRIMARY KEY ("feature", "variant"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "experiment_variant"`);
  }
}

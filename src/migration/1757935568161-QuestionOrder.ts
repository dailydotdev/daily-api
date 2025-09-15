import { MigrationInterface, QueryRunner } from "typeorm";

export class QuestionOrder1757935568161 implements MigrationInterface {
  name = 'QuestionOrder1757935568161'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "question"
        ADD "questionOrder" smallint NOT NULL DEFAULT '0'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "question"
        DROP COLUMN "questionOrder"
    `);
  }
}

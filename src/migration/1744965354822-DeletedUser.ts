import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeletedUser1744965354822 implements MigrationInterface {
  name = 'DeletedUser1744965354822';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "deleted_user" ("id" character varying(36) NOT NULL, "userDeletedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e85dad6b83f0681a83fd04fe691" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "deleted_user"`);
  }
}

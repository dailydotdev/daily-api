import { MigrationInterface, QueryRunner } from 'typeorm';

export class RequiredHandle1671781195018 implements MigrationInterface {
  name = 'RequiredHandle1671781195018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "source"
                             SET handle = id
                             WHERE handle is null`);
    await queryRunner.query(`ALTER TABLE "source"
      ALTER COLUMN "handle" SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source"
      ALTER COLUMN "handle" DROP NOT NULL`);
  }
}

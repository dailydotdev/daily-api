import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserCreatedAt1698144204806 implements MigrationInterface {
  name = 'UserCreatedAt1698144204806';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "user"
                             SET "createdAt" = now()
                             WHERE "createdAt" is null`);
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "createdAt" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "createdAt" SET DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "createdAt" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "createdAt" DROP NOT NULL`,
    );
  }
}

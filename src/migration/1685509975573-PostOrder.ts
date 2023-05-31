import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostOrder1685509975573 implements MigrationInterface {
  name = 'PostOrder1685509975573';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" ADD "showOnFeed" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "showOnFeed"`);
  }
}

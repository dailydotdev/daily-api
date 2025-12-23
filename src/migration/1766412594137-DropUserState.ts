import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUserState1766412594137 implements MigrationInterface {
  name = 'DropUserState1766412594137';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "public"."user_state"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}

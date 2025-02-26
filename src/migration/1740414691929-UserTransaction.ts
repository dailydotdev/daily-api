import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserTransaction1740414691929 implements MigrationInterface {
  name = 'UserTransaction1740414691929';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "product" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying NOT NULL, "image" character varying NOT NULL, "name" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "value" integer NOT NULL, "flags" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_bebc9158e480b949565b4dc7a82" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_transaction" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "productId" uuid, "status" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "receiverId" character varying NOT NULL, "senderId" character varying, "value" integer NOT NULL, "fee" integer NOT NULL, "request" jsonb NOT NULL DEFAULT '{}', "flags" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_e36b77a5263ac0f191277c4c5d2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_transaction" ADD CONSTRAINT "FK_71c31114b6147850698e62c4503" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_transaction" ADD CONSTRAINT "FK_1422cc85c1642eed91e947cf877" FOREIGN KEY ("receiverId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_transaction" ADD CONSTRAINT "FK_414de11cf6c18d2ddb0881f7ee9" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_transaction" DROP CONSTRAINT "FK_414de11cf6c18d2ddb0881f7ee9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_transaction" DROP CONSTRAINT "FK_1422cc85c1642eed91e947cf877"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_transaction" DROP CONSTRAINT "FK_71c31114b6147850698e62c4503"`,
    );

    await queryRunner.query(`DROP TABLE "user_transaction"`);
    await queryRunner.query(`DROP TABLE "product"`);
  }
}

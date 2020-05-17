import {MigrationInterface, QueryRunner} from "typeorm";

export class UpdateViewPK1589696758621 implements MigrationInterface {
    name = 'UpdateViewPK1589696758621'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."view" ALTER COLUMN "userId" TYPE text`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."view" DROP CONSTRAINT "PK_fad468a14a7e30dcecb02ca2d63"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."view" ADD CONSTRAINT "PK_fd3590743086a174deee22745d9" PRIMARY KEY ("postId", "userId", "timestamp")`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."view" DROP CONSTRAINT "PK_fd3590743086a174deee22745d9"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."view" ADD CONSTRAINT "PK_2f56de88bc2c88557abcd971ab1" PRIMARY KEY ("postId", "timestamp")`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."view" ALTER COLUMN "userId" TYPE character varying`, undefined);
    }

}

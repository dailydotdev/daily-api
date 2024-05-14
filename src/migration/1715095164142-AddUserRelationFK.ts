import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserRelationFK1715095164142 implements MigrationInterface {
    name = 'AddUserRelationFK1715095164142'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // UserAction
        await queryRunner.query(`
            DELETE FROM user_action WHERE "userId" IN (
                SELECT DISTINCT rt."userId" FROM user_action rt
                LEFT JOIN public.user u ON rt."userId" = u.id
                WHERE u.id IS NULL
            )
        `);
        await queryRunner.query(`ALTER TABLE "user_action" ADD CONSTRAINT "FK_c025478b45e60017ed10c77f99c" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        // Alerts
        await queryRunner.query(`
            DELETE FROM alerts WHERE "userId" IN (
                SELECT DISTINCT rt."userId" FROM alerts rt
                LEFT JOIN public.user u ON rt."userId" = u.id
                WHERE u.id IS NULL
            )
        `);
        await queryRunner.query(`ALTER TABLE "alerts" ADD CONSTRAINT "FK_f2678f7b11e5128abbbc4511906" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        // - Bookmark
        await queryRunner.query(`
            DELETE FROM bookmark WHERE "userId" IN (
                SELECT DISTINCT rt."userId" FROM bookmark rt
                LEFT JOIN public.user u ON rt."userId" = u.id
                WHERE u.id IS NULL
            )
        `);
        await queryRunner.query(`ALTER TABLE "bookmark" ADD CONSTRAINT "FK_e389fc192c59bdce0847ef9ef8b" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        // - Settings
        await queryRunner.query(`
            DELETE FROM settings WHERE "userId" IN (
                SELECT DISTINCT rt."userId" FROM settings rt
                LEFT JOIN public.user u ON rt."userId" = u.id
                WHERE u.id IS NULL
            )
        `);
        await queryRunner.query(`ALTER TABLE "settings" ADD CONSTRAINT "FK_9175e059b0a720536f7726a88c7" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        // - UserState
        await queryRunner.query(`
            DELETE FROM user_state WHERE "userId" IN (
                SELECT DISTINCT rt."userId" FROM user_state rt
                LEFT JOIN public.user u ON rt."userId" = u.id
                WHERE u.id IS NULL
            )
        `);
        await queryRunner.query(`ALTER TABLE "user_state" ADD CONSTRAINT "FK_b35c67d61943214aff1e7c94abd" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // UserAction
        await queryRunner.query(`ALTER TABLE "user_action" DROP CONSTRAINT "FK_c025478b45e60017ed10c77f99c"`);

        // Alerts
        await queryRunner.query(`ALTER TABLE "alerts" DROP CONSTRAINT "FK_f2678f7b11e5128abbbc4511906"`);

        // - Bookmark
        await queryRunner.query(`ALTER TABLE "bookmark" DROP CONSTRAINT "FK_e389fc192c59bdce0847ef9ef8b"`);

        // - Settings
        await queryRunner.query(`ALTER TABLE "settings" DROP CONSTRAINT "FK_9175e059b0a720536f7726a88c7"`);

        // - UserState
        await queryRunner.query(`ALTER TABLE "user_state" DROP CONSTRAINT "FK_b35c67d61943214aff1e7c94abd"`);
    }

}

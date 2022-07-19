import {MigrationInterface, QueryRunner} from "typeorm";

export class AddNewOneAITags1658242193484 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('application', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('company', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('app', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('system', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('api', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('work', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('development', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('software', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('services', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('product', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('case', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('post', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('apps', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('network', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('website', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('error', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('design', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('image', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dataset', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('test', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('programming', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('images', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('developer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('language', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('free', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('experience', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('resources', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('change', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('node', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('training', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('environment', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('market', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('customer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('learning', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('questions', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('methods', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('video', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('production', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('organization', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('devices', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('management', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('space', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('latest', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('framework', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('index', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('search', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('variables', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('news', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('control', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('implementation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('json', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('job', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cluster', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('game', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('success', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('operations', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('life', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('libraries', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('unsplash', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('analysis', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('-1', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('update', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('template', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('digital', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('self', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('games', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('documentation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('updates', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('home', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('online', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dependencies', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('employees', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('help', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('metrics', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('techcrunch', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('internet', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('analytics', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('software-development', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('working', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('stack', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('money', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('launch', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('risk', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('students', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('coding', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('phone', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('vector', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('guide', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('remote', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('install', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('integration', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('feedback', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pipeline', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('commands', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('create-react-app', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('connection', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('block', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('jobs', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('programming-languages', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('youtube', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('modules', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('clients', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('servers', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('query', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('knowledge', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('animation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('graph', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('colors', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('workflow', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('plugins', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('terminal', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('videos', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('distribution', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('engineering', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('health', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('extension', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pandemic', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('government', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('logic', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('virtual', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('articles', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('live', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('traffic', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('token', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('edge', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('podcast', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('industry', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('stream', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('impact', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('validation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('flow', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cache', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('music', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('audio', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ceo', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('matrix', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('media', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('challenge', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('paper', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('logrocket', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('consumer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('processing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('communication', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('manager', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('art', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('speed', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('grid', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('focus', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('forms', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('login', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ideas', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dashboard', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('social', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('designer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dev', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('loop', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('concept', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('office', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('property', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('desktop', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('founders', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('async', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('predictions', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('partners', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('books', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('setup', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('patterns', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('deal', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('commit', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('streaming', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('navigation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('review', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tips', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('chat', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('quality', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('arrays', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ip', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('bugs', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('stories', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('beta', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('building', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('credit', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('identity', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('newsletter', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('subscription', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('queue', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('covid-19', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tweet', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('export', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('https', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('financial', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('artist', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sdk', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('source-code', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('router', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tokens', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('food', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('eu', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('women', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('practice', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('culture', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('board', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('migration', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('complexity', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('maps', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('optimization', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('progress', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('metadata', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('failure', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('education', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('medium', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('payments', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('university', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('operators', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mind', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('download', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('releases', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('regression', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cloud-storage', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('installation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('best-practices', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('error-handling', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('collaboration', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('copy', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('passwords', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('portfolio', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('policy', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('notifications', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('charts', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cookies', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('interactive', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('lists', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cities', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('modeling', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('coronavirus', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('usestate', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('use-cases', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('photos', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('venture', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('exchange', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('notes', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('keyboard', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('asynchronous', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('visualization', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('experiment', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('saas', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('infoq', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fix', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('writing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('software-engineering', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('creators', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('interfaces', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('repositories', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('themes', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('financial-services', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('attention', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('brain', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('app-development', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('threads', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('threatpost', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('engineer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('excel', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('switch', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('vision', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('messaging', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('trends', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('study', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('secrets', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pdf', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('retail', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('deploy', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('intelligence', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('csv', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('filters', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sec', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('purpose', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('movies', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('notebook', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('competition', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('earth', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tracking', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('authors', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('bank', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('debugging', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('canvas', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('trees', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('xml', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('upgrade', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ecosystem', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('transformation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('beginner', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fonts', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('water', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cnn', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('routing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('computers', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('simulation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('basics', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('medical', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('reddit', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('whatsapp', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('meta', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('backup', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('speakers', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('variance', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('domains', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('professional', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('history', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('energy', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('blogger', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('middleware', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('europe', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('clustering', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('beginners', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('graphics', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('search-engines', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('relationships', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('proxy', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('partnership', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hard-work', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('s3-bucket', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('state-management', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('prototype', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('travel', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fraud', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('recommendations', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('top-10', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('delivery', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('yaml', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('weather', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('translation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('shopping', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ec2-instance', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('trump', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('kids', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('laptop', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('airbnb', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('reading', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mapping', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('running', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('codepen', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hosting', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('webinar', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('planning', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('benchmark', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('kaggle', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('insurance', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('improvement', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('adoption', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('protection', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('writer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('safety', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('college', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('certification', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('data-center', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('coffee', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ipad', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('equity', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('app-developer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('family', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('apple-watch', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('workshop', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('film', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tls', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('promises', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('efficiency', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('income', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('diversity', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('vpc', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('full-stack', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mistakes', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cameras', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('love', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('useeffect', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('reporting', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fetch', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('connectivity', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('kdnuggets', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('comparison', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('lifecycle', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('learn', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('rich', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('concurrency', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('annotations', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('logo', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('budget', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('javascript-frameworks', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('allscripts', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('product-owner', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('corporate', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('software-engineer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('freecodecamp', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pandas-dataframe', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('truth', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('os', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ios-13', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('iam', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('product-development', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dark-mode', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('solid', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('theory', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('followers', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('first-post', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mock', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('programmer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sleep', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('workplace', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('trade', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('virus', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('thoughts', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('release-notes', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('profit', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('conversations', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('teams', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sass', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('wikipedia', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cloud-migration', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('race', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sms', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('carbon', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gui', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('climate-change', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('expo', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('governance', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('regex', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('editing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('make-money', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mvc', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('rewards', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('abstract', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('universe', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('case-study', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('for-loop', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('flexbox', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sorting', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ssl', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('forecasting', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('wallet', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('restful-api', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('perspective', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('decision-making', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('product-management', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('graphic-design', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('observation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('battery', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('currency', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('restaurant', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('html-css', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('shortcuts', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('verification', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('java™', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('microsoft-teams', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('entrepreneur', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('auth', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('listing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('object-oriented', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('extra-crunch', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('transportation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('nature', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('earnings', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('python-developers', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('un', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('death', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('public-health', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fire', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('evolution', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('contracts', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('compose', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tc', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('enterprise-software', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ford', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('banks', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('inheritance', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('defense', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('wireless', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('summary', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('compression', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('war', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('transitions', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('credit-cards', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fitness', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('publishing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gmail', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('arm', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('schools', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pos', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('sports', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tricks', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('closure', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hello-world', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('android-developers', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('webpage', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('stress', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('inspiration', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('enum', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('stack-overflow', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('discount', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('construction', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('video-conferencing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('crisis', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('emissions', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pop', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('quotes', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('scrum-master', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('creativity', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('real-estate', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('email-marketing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fear', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mvp', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('risk-management', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ios-apps', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('google-sheets', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('emoji', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('scalability', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pro', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('http-request', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('refactoring', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('metal', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('recipe', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('choices', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pain', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('salary', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mars', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('stocks', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('google-maps', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('the-new-stack', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('commission', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hospital', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('scaling', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('word', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('entertainment', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('the-app-store', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tnw', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('offers', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('application-development', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('filesystem', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('teachers', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('customer-experience', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('scheduling', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('walmart', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('publication', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('web-server', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('freedom', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('accelerator', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cancer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('decimal', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('opinion', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('bug-bounty', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('mobile-phone', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fbi', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('surveillance', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('software-developer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('puzzle', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('climate', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('techcrunch+', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('caching', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('front-end-developer', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cats', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('m1', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('boss', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hashnode', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('discovery', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('blogging', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('visa', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('habits', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('advantages', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('data-driven', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('messenger', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('minimum-viable-product', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('logistics', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('scripting', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('anonymous', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gm', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('passion', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cto', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('headphones', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pair-programming', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pixabay', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('macbook-pro', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('covid', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('epic', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ea', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dataframes', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('misinformation', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cisa', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('content-marketing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('reuters', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('makers', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hotel', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('product-design', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dogs', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('onboarding', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('animals', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('configuration-management', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('fashion', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('solarwinds', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('tips-and-tricks', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('frontend-development', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('trading', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('3d-printing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('drones', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ajax', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('crud', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('swap', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('canonical', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('coroutine', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('shipping', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('forecast', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gold', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('economy', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('scam', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('next', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('codecanyon', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('doctors', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pc', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('disney+', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('emotions', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('cover', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('office-365', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ge', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('oop', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('polygon', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('scopes', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('android-app-development', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('automotive', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ios-app-development', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('anchor', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('pexels', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('gartner', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('prototyping', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('labor', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('responsive-web-design', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('labs', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dropbox', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('clubhouse', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('hashing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('dash', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('congress', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('electricity', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('smashing', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('lambda-function', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status") VALUES ('ui', 'deny') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('3d') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ab-testing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('accessibility') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('acquisition') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('active-directory') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('apache-activemq') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('adobe') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('adonisjs') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('advertising') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('agile') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ai') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('aiops') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('apache-airflow') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('akka') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('alexa') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('algolia') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('algorithms') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('alibaba') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('alibaba-cloud') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('alpinejs') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('amazon') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('aws-s3') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('aws') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('amd') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('android') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('android-studio') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('angular') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ansible') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('apache') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('apache-camel') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('apache-cassandra') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('apache-flink') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('apache-hadoop') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('apache-kafka') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('apache-spark') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('api-gateway') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('apollo') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('app-store') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('apple') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('appsec') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('appwrite') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ar') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('arangodb') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('architecture') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('aspnet') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('atlassian') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('audit') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('aurora') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('auth0') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('authentication') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('authorization') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('automation') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('testing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('automl') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('aws-ec2') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('aws-iam') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('aws-lambda') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('axios') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('azure') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('azure-devops') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('azure-functions') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('babel') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('backend') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ballerina') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('banking') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('bash') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('bazel') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('bert') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('big-data') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('big-tech') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('google-bigquery') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('binary-search') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('binary-tree') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('bitbucket') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('bitcoin') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('blazor') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('blender') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('blockchain') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('bluetooth') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('bootcamp') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('bootstrap') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('bots') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('browsers') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('bi') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('c') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('career') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('chef') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('google-chrome') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('chromium') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('cicd') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('circleci') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('cisco') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('classification') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('cli') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('clickhouse') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('clojure') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('cloud') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('gcp-cloud-functions') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('security') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('cloudflare') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('aws-cloudformation') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('aws-cloudwatch') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('cms') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('cncf') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('cockroachdb') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('code-review') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('coinbase') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('community') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('compliance') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('computer-science') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('computer-vision') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('computing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('conference') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('confluent') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('confluent-cloud') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('containers') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('couchbase') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('course') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('c++') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('crawling') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('crm') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('crypto') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('cryptography') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('c#') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('css') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('cuda') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('customer-service') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('cyber') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('cypress') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('dailydev') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('dart') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('data-analysis') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('data-breach') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('data-engineering') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('data-lake') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('data-management') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('data-processing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('data-protection') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('data-quality') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('data-science') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('data-structures') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('data-visualization') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('data-warehouse') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('database') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('databricks') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('debezium') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('decentralized') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('decision-tree') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('deep-learning') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('defi') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('deno') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('dependency-injection') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('design-patterns') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('design-systems') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('devrel') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('devops') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('devsecops') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('devtools') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('digital-transformation') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('digitalocean') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('discord') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('disney') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('django') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('dns') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('docker') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('docker-compose') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('docker-swarm') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('dom') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('.net') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('.net-core') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('dynamic-programming') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('aws-dynamodb') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ecommerce') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('edge-computing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('edtech') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('elk') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('electron') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('elixir') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('elm') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('embedded') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('emberjs') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('encryption') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('enterprise') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('entrepreneurship') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('envoy') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('erlang') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('erp') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('javascript') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ethereum') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ethics') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('etl') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('exploratory-data-analysis') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('express') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('facebook') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('facial-recognition') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('fastapi') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('fastify') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('faunadb') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('feature-engineering') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('figma') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('finance') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('fintech') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('firebase') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('firefox') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('firestore') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('flask') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('flutter') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('flux') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('fraud-detection') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('freedos') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('frontend') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('functional-programming') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('venture-capital') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('future') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('future-of-work') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('game-development') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('gaming') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('gatsby') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('gcp') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('gdpr') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('gem') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('gis') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('git') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('github') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('github-actions') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('github-pages') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('gitlab') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('gitlab-ci') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('gitops') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('gke') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('golang') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('godot') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('google') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('google-analytics') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('google-assistant') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('google-drive') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('google-play') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('gpu') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('gradient-descent') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('gradle') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('grafana') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('graphql') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('grpc') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('hackathon') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('hacktoberfest') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('hardware') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('harperdb') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('hashicorp') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('haskell') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('healthcare') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('helm') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('heroku') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('hive') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('react-hooks') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('hotwire') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('hr') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('html') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('huawei') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('hybrid-cloud') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ibm') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ibm-cloud') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('image-processing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('influxdb') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('infrastructure') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('iac') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('instagram') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('intel') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('iot') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('internship') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('interview') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('interview-questions') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('investing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ionic') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ios') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('iphone') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ipo') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('istio') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('jamstack') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('java') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('jdk') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('jenkins') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('jest') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('jetbrains') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('jetpack-compose') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('jira') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('jquery') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('jsx') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('julia') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('jupyter') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('jvm') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('jwt') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('unsupervised-learning') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('kubernetes') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('kafka') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('kaspersky') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('keras') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('kerberos') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('kotlin') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ktor') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('laravel') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('law') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('leadership') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('legal') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('lightbend') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('lighthouse') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('linear-regression') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('linkedin') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('linux') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('lisp') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('load-testing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('localization') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('logging') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('logistic-regression') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('nocode') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('lstm') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('lua') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('lyft') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('mac') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('machine-learning') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('malware') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('manufacturing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('markdown') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('marketing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('math') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('matplotlib') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('maven') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('mental-health') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('metaverse') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('microservices') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('microsoft') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('microsoft-edge') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('mit') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('mlops') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('mnist') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('mobile') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('mobility') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('mongodb') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('mongoose') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('monitoring') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('monolith') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('mozilla') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('mulesoft') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('multi-cloud') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('mysql') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('nasa') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('nativescript') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('nlp') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('neo4j') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('nestjs') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('netflix') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('netlify') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('networking') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('neural-networks') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('nextjs') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('nft') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('nginx') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('nintendo') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('nodejs') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('nosql') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('notion') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('npm') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('nuget') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('numpy') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('nvidia') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('oauth') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('object-detection') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('observability') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('okta') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('open-api') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('open-source') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('openai') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('openapi') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('opencv') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('openshift') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('oracle') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('orchestration') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('overfitting') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('pandas') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('paypal') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('performance') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('perl') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('phishing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('photoshop') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('php') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('physics') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('pinterest') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('pip') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('plotly') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('postgresql') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('postman') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('powershell') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('preact') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('predictive-analytics') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('prisma') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('privacy') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('statistics') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('startup') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('productivity') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('project-management') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('prometheus') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('public-cloud') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('pulumi') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('puppet') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('pwa') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('pyspark') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('python') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('pytorch') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('qa') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('quantum-computing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('quarkus') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('r') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('rabbitmq') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('rails') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('random-forest') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ransomware') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('raspberry-pi') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ravendb') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('aws-rds') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('react') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('react-native') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('react-query') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('react-router') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('reactive-programming') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('recursion') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('red-hat') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('redis') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('redshift') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('redux') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('regulation') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('reinforcement-learning') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('remote-work') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ui-design') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('rest-api') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('revenue') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('robotics') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('rstudio') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ruby') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('rust') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('rxjs') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('safari') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('aws-sagemaker') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('sales') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('salesforce') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('samsung') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('sap') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('scala') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('science') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('scikit') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('scrum') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('segmentation') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('selenium') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('autonomous-cars') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('sensors') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('sentiment-analysis') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('seo') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('serverless') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('service-mesh') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('sharepoint') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('shell') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('shopify') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('sinatra') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('sklearn') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('slack') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('smart-contracts') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('snap') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('snowflake') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('social-media') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('softbank') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('sony') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('spacex') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('spark') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('speech-recognition') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('spotify') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('spring') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('spring-boot') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('spring-security') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('sql') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('microsoft-sql-server') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('sqlite') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('sre') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ssh') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('steam') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('storage') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('storybook') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('stripe') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('styled-components') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('supabase') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('supply-chain') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('sustainability') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('svelte') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('svg') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('swift') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('swiftui') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('symfony') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('tableau') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('tailwind-css') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('tdd') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('tech') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('technical-debt') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('telegram') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('tensorflow') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('terraform') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('tesla') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('tiktok') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('time-complexity') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('time-series-forecasting') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('tools') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('transfer-learning') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('transformers') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('tutorial') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('twilio') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('twitch') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('twitter') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('typescript') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('uber') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ubuntu') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('unity') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('unix') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('unreal-engine') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('ux') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('v8') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('vb') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('vercel') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('version-control') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('vim') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('virtual-machine') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('vr') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('visual-studio') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('vscode') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('vite') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('vmware') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('vpn') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('vuejs') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('vuex') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('vulnerability') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('web-components') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('webdev') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('web3') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('webassembly') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('webpack') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('webrtc') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('websocket') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('windows') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('winui') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('woocommerce') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('wordpress') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('work-life-balance') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('xamarin') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('xbox') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('xcode') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('xgboost') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('yarn') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('zoom') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value") VALUES ('firmware') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );

        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('a-b-testing','synonym', 'ab-testing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('activemq','synonym', 'apache-activemq') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('agile-development','synonym', 'agile') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('airflow','synonym', 'apache-airflow') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('alpine','synonym', 'alpinejs') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('amazon-s3','synonym', 'aws-s3') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('amazon-web-services','synonym', 'aws') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('android-apps','synonym', 'android') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('angularjs','synonym', 'angular') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('apollo-client','synonym', 'apollo') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('application-security','synonym', 'appsec') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('artificial-intelligence','synonym', 'ai') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('asp.net','synonym', 'aspnet') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('augmented-reality','synonym', 'ar') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('automation-testing','synonym', 'testing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('azure-active-directory','synonym', 'active-directory') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('bigquery','synonym', 'google-bigquery') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('bot','synonym', 'bots') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('business-intelligence','synonym', 'bi') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('careers','synonym', 'career') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('cassandra','synonym', 'apache-cassandra') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('chatbot','synonym', 'bots') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('chatbots','synonym', 'bots') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('chrome','synonym', 'google-chrome') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('ci-cd-pipeline','synonym', 'cicd') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('classification-models','synonym', 'classification') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('clean-architecture','synonym', 'architecture') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('cloud-computing','synonym', 'cloud') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('cloud-functions','synonym', 'gcp-cloud-functions') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('cloud-native','synonym', 'cloud') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('cloud-security','synonym', 'security') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('cloud-services','synonym', 'cloud') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('cloudformation','synonym', 'aws-cloudformation') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('cloudwatch','synonym', 'aws-cloudwatch') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('command-line','synonym', 'cli') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('confluent','synonym', 'confluent-cloud') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('continuous-delivery','synonym', 'cicd') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('continuous-deployment','synonym', 'cicd') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('continuous-integration','synonym', 'cicd') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('conversational-ai','synonym', 'ai') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('cpp','synonym', 'c++') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('cpu','synonym', 'computing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('cryptocurrency','synonym', 'crypto') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('cryptocurrency-exchange','synonym', 'crypto') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('csharp','synonym', 'c#') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('cybersecurity','synonym', 'cyber') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('daily.dev','synonym', 'dailydev') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('data-analytics','synonym', 'data-analysis') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('data-scientist','synonym', 'data-science') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('deployment','synonym', 'cicd') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('developer-relations','synonym', 'devrel') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('docker-image','synonym', 'docker') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('dotnet','synonym', '.net') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('dotnet-5','synonym', '.net') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('dotnet-6','synonym', '.net') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('dotnet-core','synonym', '.net-core') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('dynamodb','synonym', 'aws-dynamodb') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('ec2','synonym', 'aws-ec2') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('elastic','synonym', 'elk') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('elasticsearch','synonym', 'elk') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('embedded-systems','synonym', 'embedded') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('ember','synonym', 'emberjs') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('es6','synonym', 'javascript') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('event-driven-architecture','synonym', 'architecture') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('fauna','synonym', 'faunadb') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('flink','synonym', 'apache-flink') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('front-end-development','synonym', 'frontend') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('funding','synonym', 'venture-capital') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('fundraising','synonym', 'venture-capital') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('go','synonym', 'golang') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('google-cloud','synonym', 'gcp') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('google-cloud-platform','synonym', 'gcp') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('hacker','synonym', 'security') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('hacking','synonym', 'security') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('hadoop','synonym', 'apache-hadoop') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('hooks','synonym', 'react-hooks') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('html5','synonym', 'html') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('image-classification','synonym', 'computer-vision') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('image-recognition','synonym', 'computer-vision') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('influxdb-enterprise','synonym', 'influxdb') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('infrastructure-as-code','synonym', 'iac') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('internet-of-things','synonym', 'iot') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('investment','synonym', 'venture-capital') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('investors','synonym', 'venture-capital') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('js','synonym', 'javascript') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('jupyter-notebook','synonym', 'jupyter') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('k-means-clustering','synonym', 'unsupervised-learning') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('k8s','synonym', 'kubernetes') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('kibana','synonym', 'elk') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('kubernetes-cluster','synonym', 'kubernetes') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('lambda','synonym', 'aws-lambda') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('low-code','synonym', 'nocode') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('macos','synonym', 'mac') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('mathematics','synonym', 'math') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('microsoft-azure','synonym', 'azure') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('ml','synonym', 'machine-learning') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('mobile-app','synonym', 'mobile') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('mobile-app-development','synonym', 'mobile') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('mobile-apps','synonym', 'mobile') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('mobile-development','synonym', 'mobile') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('natural-language','synonym', 'nlp') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('nfts','synonym', 'nft') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('no-code','synonym', 'nocode') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('nosql-database','synonym', 'nosql') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('open-source-software','synonym', 'open-source') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('postgres','synonym', 'postgresql') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('prisma client','synonym', 'prisma') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('probability','synonym', 'statistics') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('product-market-fit','synonym', 'startup') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('python-programming','synonym', 'python') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('python3','synonym', 'python') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('quantum','synonym', 'quantum-computing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('rds','synonym', 'aws-rds') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('react-hook','synonym', 'react-hooks') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('reactjs','synonym', 'react') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('redux-thunk','synonym', 'redux') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('remote-working','synonym', 'remote-work') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('responsive-design','synonym', 'ui-design') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('rest','synonym', 'rest-api') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('resume','synonym', 'career') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('robots','synonym', 'robotics') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('ruby-on-rails','synonym', 'rails') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('s3','synonym', 'aws-s3') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('sagemaker','synonym', 'aws-sagemaker') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('scikit-learn','synonym', 'scikit') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('selenium-webdriver','synonym', 'selenium') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('self-driving-cars','synonym', 'autonomous-cars') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('silicon-valley','synonym', 'startup') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('snapchat','synonym', 'snap') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('software-architecture','synonym', 'architecture') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('software-testing','synonym', 'testing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('spac','synonym', 'ipo') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('sql-server','synonym', 'microsoft-sql-server') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('startups','synonym', 'startup') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('stock-market','synonym', 'investing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('swagger','synonym', 'openapi') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('tailwind','synonym', 'tailwind-css') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('technical-interview','synonym', 'interview-questions') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('test-automation','synonym', 'testing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('test-driven-development','synonym', 'tdd') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('the-pulumi-service','synonym', 'pulumi') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('two-factor-authentication','synonym', 'authentication') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('ubuntu-20-04','synonym', 'ubuntu') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('unit-testing','synonym', 'testing') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('user-experience','synonym', 'ux') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('ux-design','synonym', 'ux') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('vba','synonym', 'vb') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('vc','synonym', 'venture-capital') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('virtual-reality','synonym', 'vr') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('visual-basic','synonym', 'vb') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('visual-design','synonym', 'ui-design') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('visual-studio-2019','synonym', 'visual-studio') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('visual-studio-2022','synonym', 'visual-studio') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('visual-studio-code','synonym', 'vscode') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('vs-code','synonym', 'vscode') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('vue','synonym', 'vuejs') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('vue-3','synonym', 'vuejs') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('web-design','synonym', 'ui-design') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('web-developer','synonym', 'webdev') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('web-development','synonym', 'webdev') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('web-scraping','synonym', 'crawling') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('windows-10','synonym', 'windows') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('windows-11','synonym', 'windows') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('wordpress-plugins','synonym', 'wordpress') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('wordpress-themes','synonym', 'wordpress') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('wordpress-website','synonym', 'wordpress') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('work-from-home','synonym', 'remote-work') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
        await queryRunner.query(
            `INSERT INTO "public"."keyword" ("value", "status", "synonym") VALUES ('working-from-home','synonym', 'remote-work') ON CONFLICT ("value") DO UPDATE SET value = EXCLUDED.value`,
        );            
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class Persona1777477090471 implements MigrationInterface {
  name = 'Persona1777477090471';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "persona" (
        "id" text NOT NULL,
        "title" text NOT NULL,
        "emoji" text NOT NULL,
        "tags" text array NOT NULL DEFAULT '{}',
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_persona_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      /* sql */ `
        INSERT INTO "persona" ("id", "title", "emoji", "tags", "sortOrder")
        VALUES
          ($1, 'Frontend Developer', '🌐',
           ARRAY['webdev','javascript','react','css','typescript','html','nextjs','tailwind-css','vuejs','angular','frontend','ui-design']::text[], 1),
          ($2, 'Backend Developer', '⚙️',
           ARRAY['python','java','golang','database','architecture','microservices','rest-api','graphql','docker','postgresql','redis','kafka']::text[], 2),
          ($3, 'AI/ML Engineer', '🤖',
           ARRAY['ai','machine-learning','python','data-science','deep-learning','nlp','pytorch','genai','llm','computer-vision','neural-networks','ai-agents']::text[], 3),
          ($4, 'DevOps / Cloud', '☁️',
           ARRAY['devops','cloud','aws','docker','kubernetes','cicd','terraform','linux','containers','infrastructure','monitoring','serverless','github-actions']::text[], 4),
          ($5, 'Mobile Developer', '📱',
           ARRAY['mobile','react-native','swift','android','ios','flutter','kotlin','iphone','firebase','app-store']::text[], 5),
          ($6, 'Security / Cyber', '🔒',
           ARRAY['security','cyber','data-privacy','encryption','malware','phishing','ransomware','vulnerability','compliance','appsec','cryptography']::text[], 6),
          ($7, 'Game Developer', '🎮',
           ARRAY['gaming','game-development','unity','unreal-engine','game-design','3d','blender','c++','vr','c#']::text[], 7),
          ($8, 'Data Engineer', '📊',
           ARRAY['data-science','python','data-analysis','data-visualization','big-data','database','data-engineering','machine-learning','algorithms','math','pytorch']::text[], 8),
          ($9, 'Tech Lead / Startup', '🚀',
           ARRAY['startup','tech-news','leadership','architecture','open-source','career','agile','product-management','venture-capital','business','tools']::text[], 9),
          ($10, 'Systems Programmer', '🦀',
           ARRAY['rust','c','c++','linux','golang','performance','hardware','computing','webassembly','algorithms']::text[], 10)
      `,
      [
        'frontend',
        'backend',
        'ai-ml',
        'devops',
        'mobile',
        'security',
        'gamedev',
        'data',
        'lead',
        'systems',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "persona"`);
  }
}

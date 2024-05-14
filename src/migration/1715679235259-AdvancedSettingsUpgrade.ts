import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdvancedSettingsUpgrade1715679235259
  implements MigrationInterface
{
  name = 'AdvancedSettingsUpgrade1715679235259';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // DELETE OLD GROUP ADVANCED TYPES
    await queryRunner.query(
      `DELETE FROM advanced_settings WHERE "group" = 'advanced'`,
    );
    // ADD SOURCE CONTENT CURATION
    await queryRunner.query(
      `INSERT INTO advanced_settings
        ("title", "description", "group", "options")
        VALUES
        ('Community picks', 'Posts specifically selected and submitted by daily.dev community members. These encompass a variety of content from across the web that has engaged our community.', 'content_source', '{"source": "community"}')`,
    );
    // ADD CONTENT CURATION
    await queryRunner.query(
      `INSERT INTO advanced_settings
           ("title", "description", "group", "options")
           VALUES
           ('News', 'Immediate reports and updates on important events, progress, and breakthroughs in the tech industry. This category helps you stay current with the latest in the developer world.', 'content_curation', '{"type": "news"}'),
           ('Opinions', 'Posts expressing personal views, interpretations, or predictions on various topics. These posts represent the author''s perspective and can span a wide range of subjects and viewpoints.', 'content_curation', '{"type": "opinion"}'),
           ('Listicles', 'Posts formatted as lists. These posts normally compile and describe different third-party elements, including people, objects, links or events. Each piece is curated to provide an overview of a specific theme or topic.', 'content_curation', '{"type": "listicle"}'),
           ('Comparisons', 'Posts that discuss the similarities and differences between two or more entities such as libraries or tools. These comparisons aim to clarify and help you make informed decisions or gain a better understanding of the entities involved.', 'content_curation', '{"type": "comparison"}'),
           ('Stories', 'Non-time sensitive posts providing information about certain events. These pieces delve into a topic or event, offering a point of view rather than just reporting the latest news.', 'content_curation', '{"type": "story"}'),
           ('Tutorials', 'Guides that present step-by-step instructions focusing on a specific skill or topic. These posts aim to educate and guide you through a process or technique, ensuring you understand and can replicate it.', 'content_curation', '{"type": "tutorial"}'),
           ('Release', 'Announcements or coverage of new versions or features of a product, library, or tool. These posts offer an overview of what''s new or what''s improved in a specific product.', 'content_curation', '{"type": "release"}'),
           ('Memes', 'Posts consisting of funny images, videos, or phrases that capture societal moments. These usually reflect cultural trends and ideas, evolving through user-generated modifications. Memes serve as a form of digital communication and entertainment.', 'content_curation', '{"type": "meme"}');
         `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM advanced_settings WHERE "group" = 'content_source'`,
    );
    await queryRunner.query(
      `DELETE FROM advanced_settings WHERE "group" = 'content_curation'`,
    );
    await queryRunner.query(`
    INSERT INTO "public"."advanced_settings" ("title", "description", "defaultEnabledState", "group", "options") VALUES
('Tech magazines', 'Show tech news posts that are not related directly to programming, for example, reports about tech companies, startups, venture capital, and scientific discoveries.', 't', 'advanced', '{}'),
('Non-editorial content', 'Show user-generated posts that were created on external blogging platforms. Such posts are usually not checked by professional editors for fact accuracy, spelling, grammar, and punctuation.', 't', 'advanced', '{}'),
('Showcases', 'Show posts that aim to showcase a project or other types of code snippets. These posts usually provide a demo-only of the showcased work without broader context around it.', 't', 'advanced', '{}'),
('Newsletters', 'Show posts that were published on developer newsletters. Such posts usually contain curated lists and opinionated essays.', 't', 'advanced', '{}'),
('Product launches', 'Show posts that aim to help you discover new product launches or major releases to existing developer tools.', 't', 'advanced', '{}'),
('Community picks', 'Show posts that are recommended by other community members.', 't', 'advanced', '{}');`);
  }
}

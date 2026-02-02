import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedAchievements1770072146923 implements MigrationInterface {
  name = 'SeedAchievements1770072146923';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert achievements in order by category
    // Placeholder image URL - should be updated with actual achievement icons
    const placeholderImage = 'https://media.daily.dev/image/upload/s--placeholder--/achievements/';

    await queryRunner.query(`
      INSERT INTO "achievement" ("name", "description", "image", "type", "eventType", "criteria")
      VALUES
        -- Post upvote achievements
        ('Readit!', 'Upvote 10 posts', '${placeholderImage}readit.png', 'milestone', 'post_upvote', '{"targetCount": 10}'),
        ('Everyone gets an upvote!', 'Upvote 50 posts', '${placeholderImage}everyone-upvote.png', 'milestone', 'post_upvote', '{"targetCount": 50}'),
        ('Upvote economy', 'Upvote 100 posts', '${placeholderImage}upvote-economy.png', 'milestone', 'post_upvote', '{"targetCount": 100}'),

        -- Comment upvote achievements
        ('Well said!', 'Upvote 10 comments', '${placeholderImage}well-said.png', 'milestone', 'comment_upvote', '{"targetCount": 10}'),
        ('User feedback', 'Upvote 50 comments', '${placeholderImage}user-feedback.png', 'milestone', 'comment_upvote', '{"targetCount": 50}'),

        -- Bookmark achievements
        ('Definitely gonna read it', 'Bookmark 1 post', '${placeholderImage}bookmark.png', 'milestone', 'bookmark_post', '{"targetCount": 1}'),

        -- Profile achievements
        ('Hello, World!', 'Update your profile picture', '${placeholderImage}hello-world.png', 'instant', 'profile_image_update', '{"targetCount": 1}'),
        ('Cover art', 'Update your cover picture', '${placeholderImage}cover-art.png', 'instant', 'profile_cover_update', '{"targetCount": 1}'),
        ('Hello, is it me you''re looking for?', 'Update your profile location', '${placeholderImage}location.png', 'instant', 'profile_location_update', '{"targetCount": 1}'),

        -- Experience achievements
        ('Workaholic', 'Add a work experience', '${placeholderImage}workaholic.png', 'instant', 'experience_work', '{"targetCount": 1}'),
        ('Scholar', 'Add an education experience', '${placeholderImage}scholar.png', 'instant', 'experience_education', '{"targetCount": 1}'),
        ('Open Sourcerer', 'Add an open source experience', '${placeholderImage}open-sourcerer.png', 'instant', 'experience_opensource', '{"targetCount": 1}'),
        ('Under new management', 'Add a project experience', '${placeholderImage}project.png', 'instant', 'experience_project', '{"targetCount": 1}'),
        ('Gentle soul', 'Add a volunteering experience', '${placeholderImage}gentle-soul.png', 'instant', 'experience_volunteering', '{"targetCount": 1}'),
        ('The right tool for the job', 'Add 3 skills to your profile', '${placeholderImage}skills.png', 'milestone', 'experience_skill', '{"targetCount": 3}'),

        -- Hot takes achievements
        ('It''s getting hot in here!', 'Add 3 hot takes to your profile', '${placeholderImage}hot-takes.png', 'milestone', 'hot_take_create', '{"targetCount": 3}'),

        -- Post creation achievements
        ('Town crier', 'Share a link (post)', '${placeholderImage}town-crier.png', 'instant', 'post_share', '{"targetCount": 1}'),
        ('Free for all', 'Create a freeform post', '${placeholderImage}freeform.png', 'instant', 'post_freeform', '{"targetCount": 1}'),

        -- Squad achievements
        ('Squad up', 'Join a squad', '${placeholderImage}squad-up.png', 'instant', 'squad_join', '{"targetCount": 1}'),
        ('Team player', 'Join 5 squads', '${placeholderImage}team-player.png', 'milestone', 'squad_join', '{"targetCount": 5}'),
        ('Hop on dailydev', 'Create your own squad', '${placeholderImage}squad-create.png', 'instant', 'squad_create', '{"targetCount": 1}'),

        -- Brief achievements
        ('Debriefed', 'Read 5 briefs', '${placeholderImage}debriefed.png', 'milestone', 'brief_read', '{"targetCount": 5}'),

        -- Reputation achievements
        ('You''re him!', 'Gain 500 reputation', '${placeholderImage}youre-him.png', 'milestone', 'reputation_gain', '{"targetCount": 500}'),
        ('In the big league', 'Gain 10000 reputation', '${placeholderImage}big-league.png', 'milestone', 'reputation_gain', '{"targetCount": 10000}')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete all seeded achievements
    await queryRunner.query(`
      DELETE FROM "achievement"
      WHERE "name" IN (
        'Readit!',
        'Everyone gets an upvote!',
        'Upvote economy',
        'Well said!',
        'User feedback',
        'Definitely gonna read it',
        'Hello, World!',
        'Cover art',
        'Hello, is it me you''re looking for?',
        'Workaholic',
        'Scholar',
        'Open Sourcerer',
        'Under new management',
        'Gentle soul',
        'The right tool for the job',
        'It''s getting hot in here!',
        'Town crier',
        'Free for all',
        'Squad up',
        'Team player',
        'Hop on dailydev',
        'Debriefed',
        'You''re him!',
        'In the big league'
      )
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedAchievements1770072146923 implements MigrationInterface {
  name = 'SeedAchievements1770072146923';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        INSERT INTO "achievement" ("name", "description", "image", "type", "eventType", "criteria", "points")
        VALUES
          -- Post upvote achievements (giving upvotes)
          ('Readit!', 'Upvote 10 posts', 'https://daily-now-res.cloudinary.com/image/upload/s--XOv44sTZ--/q_auto/v1770765983/achievements/readit.png', 'milestone', 'post_upvote', '{"targetCount": 10}', 10),
          ('Everyone gets an upvote!', 'Upvote 50 posts', 'https://daily-now-res.cloudinary.com/image/upload/s--5NyTYRBL--/q_auto/v1770765982/achievements/Everyone_gets_an_upvote.png', 'milestone', 'post_upvote', '{"targetCount": 50}', 15),
          ('Upvote economy', 'Upvote 100 posts', 'https://daily-now-res.cloudinary.com/image/upload/s--yaK6lPac--/c_fill,h_512,q_auto,w_512/v1770800203/achievements/upvote_economy.png', 'milestone', 'post_upvote', '{"targetCount": 100}', 25),

          -- Comment upvote achievements (giving upvotes)
          ('Well said!', 'Upvote 10 comments', 'https://daily-now-res.cloudinary.com/image/upload/v1770800624/achievements/well_said.png', 'milestone', 'comment_upvote', '{"targetCount": 10}', 10),
          ('User feedback', 'Upvote 50 comments', 'https://daily-now-res.cloudinary.com/image/upload/s--1A72LwN2--/q_auto/v1770765983/achievements/User_feedback.png', 'milestone', 'comment_upvote', '{"targetCount": 50}', 15),

          -- Bookmark achievements
          ('Definitely gonna read it', 'Bookmark 1 post', 'https://daily-now-res.cloudinary.com/image/upload/v1770222883/achievements/Definitely_gonna_read_it.png', 'milestone', 'bookmark_post', '{"targetCount": 1}', 5),

          -- Profile achievements
          ('Hello, World!', 'Update your profile picture', 'https://daily-now-res.cloudinary.com/image/upload/s--_hEkz93E--/q_auto/v1770765982/achievements/Hello_World.png', 'instant', 'profile_image_update', '{"targetCount": 1}', 5),
          ('Cover art', 'Update your cover picture', 'https://daily-now-res.cloudinary.com/image/upload/s--O10uQlIF--/q_auto/v1770768363/achievements/Cover_art.jpg', 'instant', 'profile_cover_update', '{"targetCount": 1}', 5),
          ('Hello, is it me you''re looking for?', 'Update your profile location', 'https://daily-now-res.cloudinary.com/image/upload/s--Y9w2hjcK--/q_auto/v1770765982/achievements/Hello_is_it_me_you_re_looking_for.png', 'instant', 'profile_location_update', '{"targetCount": 1}', 5),
          ('All about me', 'Complete your profile 100%', 'https://daily-now-res.cloudinary.com/image/upload/v1770222887/achievements/All_about_me.png', 'instant', 'profile_complete', '{"targetCount": 1}', 15),

          -- Experience achievements
          ('Workaholic', 'Add a work experience', 'https://daily-now-res.cloudinary.com/image/upload/s--EsP6t5nK--/q_auto/v1770765986/achievements/Workaholic.png', 'instant', 'experience_work', '{"targetCount": 1}', 5),
          ('Scholar', 'Add an education experience', 'https://daily-now-res.cloudinary.com/image/upload/s--0O2eh2u4--/q_auto/v1770799625/achievements/Scholar.png', 'instant', 'experience_education', '{"targetCount": 1}', 5),
          ('Open Sourcerer', 'Add an open source experience', 'https://daily-now-res.cloudinary.com/image/upload/s--ZJ1NqHAW--/q_auto/v1770765982/achievements/Open_Sourcerer.png', 'instant', 'experience_opensource', '{"targetCount": 1}', 5),
          ('Under new management', 'Add a project experience', 'https://daily-now-res.cloudinary.com/image/upload/v1770222936/achievements/Under_new_management.png', 'instant', 'experience_project', '{"targetCount": 1}', 5),
          ('Gentle soul', 'Add a volunteering experience', 'https://daily-now-res.cloudinary.com/image/upload/v1770222887/achievements/Gentle_soul.png', 'instant', 'experience_volunteering', '{"targetCount": 1}', 5),
          ('Certifiably certified', 'Add a certification to your profile', 'https://daily-now-res.cloudinary.com/image/upload/v1770222884/achievements/Certifiably_Certified.png', 'instant', 'experience_certification', '{"targetCount": 1}', 5),
          ('The right tool for the job', 'Add 3 skills to your profile', 'https://daily-now-res.cloudinary.com/image/upload/s--4IgTQ1hp--/q_auto/v1770800817/achievements/The_right_tool_for_the_job.png', 'milestone', 'experience_skill', '{"targetCount": 3}', 10),

          -- Hot takes achievements
          ('It''s getting hot in here!', 'Add 3 hot takes to your profile', 'https://daily-now-res.cloudinary.com/image/upload/v1770222926/achievements/It_s_getting_hot_in_here.png', 'milestone', 'hot_take_create', '{"targetCount": 3}', 10),

          -- Post creation achievements
          ('Town crier', 'Share a link (post)', 'https://daily-now-res.cloudinary.com/image/upload/v1770222937/achievements/Town_crier.png', 'instant', 'post_share', '{"targetCount": 1}', 10),
          ('Free for all', 'Create a freeform post', 'https://daily-now-res.cloudinary.com/image/upload/v1770222888/achievements/free_for_all.png', 'instant', 'post_freeform', '{"targetCount": 1}', 10),

          -- Squad achievements
          ('Squad up', 'Join a squad', 'https://daily-now-res.cloudinary.com/image/upload/s--kpMne7j---/q_auto/v1770765990/achievements/Squad_up.png', 'instant', 'squad_join', '{"targetCount": 1}', 5),
          ('Team player', 'Join 5 squads', 'https://daily-now-res.cloudinary.com/image/upload/v1770222931/achievements/Team_player.png', 'milestone', 'squad_join', '{"targetCount": 5}', 20),
          ('Hop on dailydev', 'Create your own squad', 'https://daily-now-res.cloudinary.com/image/upload/v1770222927/achievements/Hop_on_dailydev.png', 'instant', 'squad_create', '{"targetCount": 1}', 20),

          -- Brief achievements
          ('Debriefed', 'Read 5 briefs', 'https://daily-now-res.cloudinary.com/image/upload/v1770222884/achievements/Debriefed.png', 'milestone', 'brief_read', '{"targetCount": 5}', 15),

          -- Reputation achievements
          ('You''re him!', 'Gain 500 reputation', 'https://daily-now-res.cloudinary.com/image/upload/v1770222931/achievements/Youre_him.png', 'milestone', 'reputation_gain', '{"targetCount": 500}', 40),
          ('In the big league', 'Gain 10000 reputation', 'https://daily-now-res.cloudinary.com/image/upload/v1770222928/achievements/In_the_big_league.png', 'milestone', 'reputation_gain', '{"targetCount": 10000}', 50),

          -- Comment creation achievements
          ('Got something to say', 'Write your first comment', 'https://daily-now-res.cloudinary.com/image/upload/v1770222890/achievements/Got_something_to_say.png', 'milestone', 'comment_create', '{"targetCount": 1}', 5),
          ('Well, actually...', 'Write 50 comments', 'https://daily-now-res.cloudinary.com/image/upload/v1770232584/achievements/Well_actually.png', 'milestone', 'comment_create', '{"targetCount": 50}', 20),
          ('Senator', 'Write 100 comments', 'https://daily-now-res.cloudinary.com/image/upload/v1770233009/achievements/Well_Spoken.png', 'milestone', 'comment_create', '{"targetCount": 100}', 25),

          -- Top reader achievements
          ('Professional reader', 'Earn your first top reader badge', 'https://daily-now-res.cloudinary.com/image/upload/v1770224907/achievements/Professional_reader.png', 'milestone', 'top_reader_badge', '{"targetCount": 1}', 30),
          ('Touch grass', 'Earn 10 top reader badges', 'https://daily-now-res.cloudinary.com/image/upload/v1770222937/achievements/Touch_grass.png', 'milestone', 'top_reader_badge', '{"targetCount": 10}', 40),

          -- Reading streak achievements
          ('Just getting started', 'Reach a 10-day reading streak', 'https://daily-now-res.cloudinary.com/image/upload/v1770222919/achievements/Just_getting_started.png', 'milestone', 'reading_streak', '{"targetCount": 10}', 15),
          ('Committed', 'Reach a 50-day reading streak', 'https://daily-now-res.cloudinary.com/image/upload/v1770222887/achievements/Comitted.png', 'milestone', 'reading_streak', '{"targetCount": 50}', 30),
          ('I took "daily dev" literally', 'Reach a 365-day reading streak', 'https://daily-now-res.cloudinary.com/image/upload/v1770224984/achievements/I_took_dailydev_literally.png', 'milestone', 'reading_streak', '{"targetCount": 365}', 50),

          -- Custom feed achievement
          ('Power user', 'Create a custom feed', 'https://daily-now-res.cloudinary.com/image/upload/v1770222920/achievements/Power_user.png', 'instant', 'feed_create', '{"targetCount": 1}', 10),

          -- Bookmark folder achievement
          ('Organized', 'Create a bookmark folder', 'https://daily-now-res.cloudinary.com/image/upload/v1770222923/achievements/Organized.png', 'instant', 'bookmark_list_create', '{"targetCount": 1}', 10),

          -- CV upload achievement
          ('Curriculum Vitae', 'Upload your CV', 'https://daily-now-res.cloudinary.com/image/upload/v1770222886/achievements/Curriculum_Vitae.png', 'instant', 'cv_upload', '{"targetCount": 1}', 10),

          -- Post boost achievement
          ('Boosted', 'Boost a post', 'https://daily-now-res.cloudinary.com/image/upload/v1770222884/achievements/Boosted.png', 'instant', 'post_boost', '{"targetCount": 1}', 20),

          -- Upvote received achievements (receiving upvotes)
          ('Good stuff, buddy!', 'Receive your first upvote', 'https://daily-now-res.cloudinary.com/image/upload/v1770222888/achievements/Good_stuff_buddy.png', 'milestone', 'upvote_received', '{"targetCount": 1}', 5),
          ('You''re the cool kid!', 'Receive 100 upvotes', 'https://daily-now-res.cloudinary.com/image/upload/v1770222932/achievements/You_re_the_cool_kid.png', 'milestone', 'upvote_received', '{"targetCount": 100}', 25),
          ('True chad', 'Receive 1000 upvotes', 'https://daily-now-res.cloudinary.com/image/upload/v1770222934/achievements/True_chad.png', 'milestone', 'upvote_received', '{"targetCount": 1000}', 40),

          -- Award received achievement
          ('Not a Nobel prize, but...', 'Receive an award', 'https://daily-now-res.cloudinary.com/image/upload/v1770231401/achievements/Not_a_nobel_prize_but.png', 'instant', 'award_received', '{"targetCount": 1}', 50),

          -- Award given achievements (giving awards)
          ('Altruistic', 'Give your first award', 'https://daily-now-res.cloudinary.com/image/upload/s--bwQRPWPt--/q_auto/v1770802226/achievements/altruistic.png', 'milestone', 'award_given', '{"targetCount": 1}', 10),
          ('The giver', 'Give 5 awards', 'https://daily-now-res.cloudinary.com/image/upload/s--rqITPZUP--/q_auto/v1770802066/achievements/the_giver.png', 'milestone', 'award_given', '{"targetCount": 5}', 20),
          ('The head of the committee', 'Give 10 awards', 'https://daily-now-res.cloudinary.com/image/upload/s--N7NXEDEH--/q_auto/v1770803408/achievements/the_head_of_the_committee.png', 'milestone', 'award_given', '{"targetCount": 10}', 30),

          -- User follow achievements
          ('Acolyte', 'Follow another user', 'https://daily-now-res.cloudinary.com/image/upload/v1770222885/achievements/Acolyte.png', 'instant', 'user_follow', '{"targetCount": 1}', 5),
          ('Sheeple', 'Follow 10 users', 'https://daily-now-res.cloudinary.com/image/upload/v1770222927/achievements/Sheeple.png', 'milestone', 'user_follow', '{"targetCount": 10}', 20),

          -- Follower gain achievements
          ('Shepherd', 'Gain 10 followers', 'https://daily-now-res.cloudinary.com/image/upload/v1770222926/achievements/Shepherd.png', 'milestone', 'follower_gain', '{"targetCount": 10}', 15),
          ('Prophet', 'Gain 100 followers', 'https://daily-now-res.cloudinary.com/image/upload/v1770222920/achievements/Prophet.png', 'milestone', 'follower_gain', '{"targetCount": 100}', 30),

          -- Plus subscription achievements
          ('1UP', 'Subscribe to Plus', 'https://daily-now-res.cloudinary.com/image/upload/v1770222884/achievements/1UP.png', 'instant', 'plus_subscribe', '{"targetCount": 1}', 25),
          ('Loyalist', 'Stay subscribed to Plus for 12 months', 'https://daily-now-res.cloudinary.com/image/upload/v1770222925/achievements/Loyalist.png', 'milestone', 'subscription_anniversary', '{"targetCount": 12}', 40),

          -- Share click achievements
          ('Check it out', 'Get someone to click your shared link', 'https://daily-now-res.cloudinary.com/image/upload/v1770222886/achievements/Check_it_out.png', 'instant', 'share_click', '{"targetCount": 1}', 10),
          ('Hot Topic', 'Get 100 clicks on a shared link', 'https://daily-now-res.cloudinary.com/image/upload/v1770222917/achievements/Hot_Topic.png', 'milestone', 'share_click_milestone', '{"targetCount": 100}', 30),
          ('Curator', 'Have 10 different shared links clicked', 'https://daily-now-res.cloudinary.com/image/upload/v1770222887/achievements/Curator.png', 'milestone', 'share_posts_clicked', '{"targetCount": 10}', 25)
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "achievement"`);
  }
}

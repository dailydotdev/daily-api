import 'reflect-metadata';
import '../src/config';
import createOrGetConnection from '../src/db';
import { PubSub } from '@google-cloud/pubsub';
import postUpdatedWorker from '../src/workers/postUpdated';
import { logger } from '../src/logger';

(async () => {
  console.log('Processing Twitter post directly via worker handler...');

  const twitterPostData = {
    id: '083a233b-a110-594a-8fb4-04cbc61dfea8',
    post_id: '5JplLtgmq',
    content_type: 'social:twitter',
    source_id: 'unknown',
    origin: 'crawler',
    order: 0,
    url: 'https://x.com/bcherny/status/2021385273788309644',
    image:
      'https://pbs.twimg.com/profile_images/1902044548936953856/J2jeik0t_normal.jpg',
    title: '@mikegiannulis I use both Cowork and Claude Code personally',
    published_at: '2026-02-11T00:46:19Z',
    updated_at: new Date().toISOString(),
    language: 'en',
    meta: {
      enriched: {
        provider: 'claude-sonnet-4-5-20250929',
      },
      language: {
        provider: 'google_translate',
      },
    },
    content_quality: {
      is_ai_probability: 0,
      is_clickbait_probability: 0,
      specificity: 'highly-specific',
      intent: 'informing',
      substance_depth: 'thin',
      title_content_alignment: 'matches',
    },
    extra: {
      author_avatar:
        'https://pbs.twimg.com/profile_images/1902044548936953856/J2jeik0t_normal.jpg',
      author_name: 'Boris Cherny',
      author_username: '@',
      author_verified: true,
      content: '@mikegiannulis I use both Cowork and Claude Code personally',
      content_html:
        '<p>@mikegiannulis I use both Cowork and Claude Code personally</p>',
      created_at: '2026-02-11T00:46:19Z',
      thread_size: 1,
      tweet_id: '2021385273788309644',
    },
  };

  const con = await createOrGetConnection();
  const pubsub = new PubSub();

  // Reset the post so the update can proceed (metadataChangedAt must be older than updated_at)
  await con.query(
    `UPDATE "post" SET "metadataChangedAt" = '2000-01-01' WHERE id = $1`,
    [twitterPostData.post_id],
  );

  const message = {
    messageId: 'demo-twitter-post',
    data: Buffer.from(JSON.stringify(twitterPostData)),
  };

  await postUpdatedWorker.handler(message, con, logger, pubsub);

  const updated = await con.query(
    `SELECT id, title, url, image, "sourceId", type, "subType", "yggdrasilId" FROM post WHERE id = $1`,
    [twitterPostData.post_id],
  );
  console.log('Updated post:', JSON.stringify(updated?.[0], null, 2));

  process.exit(0);
})();

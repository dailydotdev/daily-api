import fetch from 'node-fetch';
import { Cron } from './cron';
import { Post } from '../entity';

const cron: Cron = {
  name: 'hashnodeBadge',
  handler: async (con) => {
    const post = await con
      .getRepository(Post)
      .createQueryBuilder()
      .select('*')
      .from(Post, 'post')
      .where(`post."createdAt" >= now()::date - interval '1 day'`)
      .andWhere('post."createdAt" < now()::date')
      .andWhere(`post."sourceId" = 'hashnode'`)
      .orderBy('post.upvotes', 'DESC')
      .getRawOne<Post>();
    const res = await fetch(process.env.HASHNODE_WEBHOOK, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ url: post.url }),
    });
    if (res.status >= 200 && res.status < 300) {
      console.info(`[${post.id}] rewarded a new post on hashnode`);
    } else {
      console.error(
        `[${post.id}] failed to send request to hashnode webhook`,
        await res.text(),
      );
    }
  },
};

export default cron;

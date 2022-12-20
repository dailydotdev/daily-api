import { MoreThanOrEqual } from 'typeorm';
import { getDiscussionLink, tweet } from '../common';
import { ArticlePost, MachineSource } from '../entity';
import { Cron } from './cron';

const getSiteHandler = async (post: ArticlePost): Promise<string> => {
  if (post.siteTwitter && post.siteTwitter.length > 1) {
    return post.siteTwitter;
  }

  const source = (await post.source) as MachineSource;
  if (source.twitter) {
    return `@${source.twitter}`;
  }

  return null;
};

const getUserHandler = (post: ArticlePost): string =>
  post.creatorTwitter?.length > 1 && post.creatorTwitter;

const buildTweet = async (post: ArticlePost): Promise<string> => {
  const link = getDiscussionLink(post.id);
  const siteHandler = await getSiteHandler(post);
  const via = siteHandler ? ` via ${siteHandler}` : '';
  const userHandler = getUserHandler(post);
  const by = userHandler ? ` by ${userHandler}` : '';
  const tags = post.tagsStr?.split(',') ?? [];
  const hashtags = tags.map((tag) => `#${tag.replace(/-| /g, '')}`).join(' ');
  return `${post.title}${by}${via}\n${hashtags}\n\n${link}`;
};

const cron: Cron = {
  name: 'tweet-trending',
  handler: async (con) => {
    const repo = con.getRepository(ArticlePost);
    const post = await repo.findOne({
      where: { tweeted: false, views: MoreThanOrEqual(200), type: 'article' },
      order: { createdAt: 'DESC' },
      relations: ['source'],
    });
    if (post) {
      await repo.update({ id: post.id }, { tweeted: true });
      await tweet(await buildTweet(post));
    }
  },
};

export default cron;

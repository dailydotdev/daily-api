import Router from 'koa-router';
import config from '../config';
import post from '../models/post';
import { tweet } from '../twitter';

const getSiteHandler = (model) => {
  if (model.twitter) {
    return `@${model.twitter}`;
  }

  if (model.siteTwitter) {
    return model.siteTwitter;
  }

  return null;
};

const buildTweet = (model, tags) => {
  const link = `${config.urlPrefix}/r/${model.id}`;
  const siteHandler = getSiteHandler(model);
  const via = siteHandler ? ` via ${siteHandler}` : '';
  const by = model.creatorTwitter ? ` by ${model.creatorTwitter}` : '';
  const hashtags = tags.map(tag => `#${tag.replace(/-/g, '')}`).join(' ');
  return `${model.title}${via}${by}\n${hashtags}\n\n${link}`;
};

const router = Router({
  prefix: '/tweet',
});

router.get(
  '/trending',
  async (ctx) => {
    const model = await post.getPostToTweet();
    if (model) {
      const tags = await post.getPostTags(model.id);
      ctx.log.info(`tweeting post ${model.id}`);
      await post.setPostsAsTweeted(model.id);
      await tweet(buildTweet(model, tags));
    }
    ctx.status = 204;
  },
);

export default router;

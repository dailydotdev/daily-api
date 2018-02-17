import Router from 'koa-router';
import config from '../config';
import post from '../models/post';
import { tweet } from '../twitter';

const buildTweet = (model) => {
  const link = `${config.urlPrefix}/r/${model.id}`;
  const via = model.twitter ? ` via @${model.twitter}` : '';
  return `${model.title}${via}\n\n${link}`;
};

const router = Router({
  prefix: '/tweet',
});

router.get(
  '/trending',
  async (ctx) => {
    const model = await post.getPostToTweet();
    if (model) {
      ctx.log.info(`tweeting post ${model.id}`);
      await post.setPostsAsTweeted(model.id);
      await tweet(buildTweet(model));
    }
    ctx.status = 204;
  },
);

export default router;

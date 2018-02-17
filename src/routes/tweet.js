import Router from 'koa-router';
import rp from 'request-promise-native';
import config from '../config';
import post from '../models/post';
import { tweet, uploadImage } from '../twitter';

const buildTweet = (model) => {
  const link = `${config.urlPrefix}/r/${model.id}`;
  const via = model.twitter ? ` via @${model.twitter}` : '';
  return `${model.title}${via}\n\n${link}`;
};

const getMediaIds = async (image) => {
  if (image) {
    const data = await rp({ url: image, encoding: null });
    const media = await uploadImage(data);
    return [media.media_id_string];
  }

  return [];
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
      const mediaIds = await getMediaIds(model.image);
      await tweet(buildTweet(model), mediaIds);
    }
    ctx.status = 204;
  },
);

export default router;

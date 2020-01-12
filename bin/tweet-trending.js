import config from '../src/config';
import post from '../src/models/post';
import { tweet } from '../src/twitter';

const getSiteHandler = (model) => {
  if (model.twitter) {
    return `@${model.twitter}`;
  }

  if (model.siteTwitter) {
    return model.siteTwitter;
  }

  return null;
};

const buildTweet = (model) => {
  const link = `${config.urlPrefix}/r/${model.id}`;
  const siteHandler = getSiteHandler(model);
  const via = siteHandler ? ` via ${siteHandler}` : '';
  const by = model.creatorTwitter ? ` by ${model.creatorTwitter}` : '';
  const hashtags = model.tags.map(tag => `#${tag.replace(/-| /g, '')}`).join(' ');
  return `${model.title}${via}${by}\n${hashtags}\n\n${link}`;
};

const tweetTrending = async () => {
  const res = await post.generateFeed({
    fields: ['id', 'title', 'image', 'createdAt', 'siteTwitter', 'creatorTwitter', 'publicationTwitter', 'tags'],
    page: 0,
    pageSize: 1,
  }, query =>
    query.where(`${post.table}.tweeted`, '=', 0).andWhere(`${post.table}.views`, '>=', 200).orderBy('created_at', 'desc'));
  const model = res.length ? res[0] : null;
  if (model) {
    await post.setPostsAsTweeted(model.id);
    await tweet(buildTweet(model));
  }
};

// eslint-disable-next-line no-console
console.log('looking for trending post to tweet');
tweetTrending()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('done');
    process.exit();
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(-1);
  });

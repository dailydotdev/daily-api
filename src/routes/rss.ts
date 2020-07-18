import { ServerResponse } from 'http';
import {
  FastifyInstance,
  RequestHandler,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import { getConnection, SelectQueryBuilder, Connection } from 'typeorm';
import rateLimit from 'fastify-rate-limit';
import RSS from 'rss';
import {
  fetchUser,
  selectSource,
  User,
  whereSourcesInFeed,
  whereTagsInFeed,
} from '../common';
import { Post, Bookmark, BookmarkList, Feed } from '../entity';

interface RssItem {
  id: string;
  title: string;
  url: string;
  publishedAt: Date;
}

const generateRSS = <State>(
  extractUserId: (req: FastifyRequest, state: State) => Promise<string | null>,
  title: (user: User, state: State) => string,
  orderBy: string,
  query: (
    req: FastifyRequest,
    user: User,
    builder: SelectQueryBuilder<Post>,
  ) => SelectQueryBuilder<Post>,
  stateFactory?: (req: FastifyRequest, con: Connection) => Promise<State>,
): RequestHandler => async (
  req,
  res,
): Promise<FastifyReply<ServerResponse>> => {
  const con = getConnection();
  const state = stateFactory ? await stateFactory(req, con) : null;
  const userId = await extractUserId(req, state);
  const user = userId && (await fetchUser(userId));
  if (!user || !user.premium) {
    return res.status(403).send();
  }
  /* eslint-disable @typescript-eslint/camelcase */
  const feed = new RSS({
    title: `${title(user, state)} by daily.dev`,
    generator: 'Daily Premium RSS',
    feed_url: `${process.env.URL_PREFIX}${req.raw.url}`,
    site_url: 'https://daily.dev',
  });
  /* eslint-enable @typescript-eslint/camelcase */
  const builder = query(
    req,
    user,
    con
      .createQueryBuilder()
      .select(['post."id"', 'post."title"'])
      .from(Post, 'post')
      .orderBy(orderBy, 'DESC')
      .limit(20),
  );
  const items = await builder.getRawMany<RssItem>();
  items.forEach((x) =>
    feed.item({
      title: x.title,
      url: `${process.env.URL_PREFIX}/r/${x.id}`,
      date: x.publishedAt,
      guid: x.id,
      description: '',
    }),
  );
  return res.type('application/rss+xml').send(feed.xml());
};

const extractFirstName = (user: User): string => user.name.split(' ')[0];

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  fastify.get(
    '/b/l/:listId',
    generateRSS<BookmarkList>(
      (req, list) => Promise.resolve(list?.userId),
      (user, list) => `${list.name} List`,
      'bookmark.createdAt',
      (req, user, builder) =>
        builder
          .addSelect('bookmark."createdAt"', 'publishedAt')
          .innerJoin(Bookmark, 'bookmark', 'post.id = bookmark.postId')
          .where('bookmark.listId = :listId', { listId: req.params.listId }),
      (req, con) =>
        con
          .getRepository(BookmarkList)
          .findOne(req.params.listId)
          .catch(() => null),
    ),
  );

  fastify.get(
    '/b/:userId',
    generateRSS(
      (req) => Promise.resolve(req.params.userId),
      (user) => `${extractFirstName(user)}'s Bookmarks`,
      'bookmark.createdAt',
      (req, user, builder) =>
        builder
          .addSelect('bookmark."createdAt"', 'publishedAt')
          .innerJoin(Bookmark, 'bookmark', 'post.id = bookmark.postId')
          .where('bookmark.userId = :userId', { userId: user.id }),
    ),
  );

  fastify.get(
    '/f/:feedId',
    generateRSS<Feed>(
      (req, feed) => Promise.resolve(feed?.userId),
      (user) => `${extractFirstName(user)}'s Feed`,
      'post.createdAt',
      (req, user, builder) =>
        builder
          .addSelect('post."createdAt"', 'publishedAt')
          .innerJoin(
            (subBuilder) => selectSource(user.id, subBuilder),
            'source',
            'source."sourceId" = post."sourceId"',
          )
          .where((subBuilder) =>
            whereSourcesInFeed(req.params.feedId, subBuilder),
          )
          .andWhere((subBuilder) =>
            whereTagsInFeed(req.params.feedId, subBuilder),
          ),
      (req, con) => con.getRepository(Feed).findOne(req.params.feedId),
    ),
  );
}

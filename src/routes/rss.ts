import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getConnection, SelectQueryBuilder, Connection } from 'typeorm';
import rateLimit from 'fastify-rate-limit';
import RSS from 'rss';
import {
  fetchUser,
  User,
  whereSourcesInFeed,
  whereTagsInFeed,
} from '../common';
import { Post, Bookmark, BookmarkList, Feed } from '../entity';
import { RouteGenericInterface, RouteHandlerMethod } from 'fastify/types/route';
import {
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from 'fastify/types/utils';

interface RssItem {
  id: string;
  shortId: string;
  title: string;
  url: string;
  publishedAt: Date;
  tagsStr?: string;
}

const generateRSS =
  <State, RouteGeneric extends RouteGenericInterface = RouteGenericInterface>(
    extractUserId: (
      req: FastifyRequest<RouteGeneric>,
      state: State,
    ) => Promise<string | null>,
    title: (user: User, state: State) => string,
    orderBy: string,
    query: (
      req: FastifyRequest<RouteGeneric>,
      user: User,
      builder: SelectQueryBuilder<Post>,
    ) => SelectQueryBuilder<Post>,
    stateFactory?: (
      req: FastifyRequest<RouteGeneric>,
      con: Connection,
    ) => Promise<State>,
  ): RouteHandlerMethod<
    RawServerDefault,
    RawRequestDefaultExpression,
    RawReplyDefaultExpression,
    RouteGeneric
  > =>
  async (req, res): Promise<FastifyReply> => {
    const con = getConnection();
    const state = stateFactory ? await stateFactory(req, con) : null;
    const userId = await extractUserId(req, state);
    const user = userId && (await fetchUser(userId));
    if (!user || !user.premium) {
      return res.status(403).send();
    }
    const feed = new RSS({
      title: `${title(user, state)} by daily.dev`,
      generator: 'Daily Premium RSS',
      feed_url: `${process.env.URL_PREFIX}${req.raw.url}`,
      site_url: 'https://daily.dev',
    });
    const builder = query(
      req,
      user,
      con
        .createQueryBuilder()
        .select([
          'post."id"',
          'post."shortId"',
          'post."title"',
          'post."tagsStr"',
        ])
        .from(Post, 'post')
        .orderBy(orderBy, 'DESC')
        .limit(20),
    );
    const items = await builder.getRawMany<RssItem>();
    items.forEach((x) =>
      feed.item({
        title: x.title,
        url: `${process.env.URL_PREFIX}/r/${x.shortId}`,
        date: x.publishedAt,
        guid: x.id,
        description: '',
        categories: x.tagsStr?.split(','),
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
    generateRSS<BookmarkList, { Params: { listId: string } }>(
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
    generateRSS<unknown, { Params: { userId: string } }>(
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
    generateRSS<Feed, { Params: { feedId: string } }>(
      (req, feed) => Promise.resolve(feed?.userId),
      (user) => `${extractFirstName(user)}'s Feed`,
      'post.createdAt',
      (req, user, builder) =>
        builder
          .addSelect('post."createdAt"', 'publishedAt')
          .where((subBuilder) =>
            whereSourcesInFeed(req.params.feedId, subBuilder, 'post'),
          )
          .andWhere((subBuilder) =>
            whereTagsInFeed(req.params.feedId, subBuilder, 'post'),
          ),
      (req, con) => con.getRepository(Feed).findOne(req.params.feedId),
    ),
  );
}

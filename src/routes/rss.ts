import {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RouteGenericInterface,
} from 'fastify';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import rateLimit from '@fastify/rate-limit';
import RSS from 'rss';
import {
  fetchUser,
  getDiscussionLink,
  getUserProfileUrl,
  User,
} from '../common';
import { Post, Bookmark, Settings } from '../entity';
import createOrGetConnection from '../db';
import { TypeORMQueryFailedError } from '../errors';

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
      state: State | null,
    ) => Promise<string | null>,
    title: (user: User, state: State | null) => string,
    orderBy: string,
    query: (
      req: FastifyRequest<RouteGeneric>,
      user: User,
      builder: SelectQueryBuilder<Post>,
    ) => SelectQueryBuilder<Post>,
    stateFactory?: (
      req: FastifyRequest<RouteGeneric>,
      con: DataSource,
    ) => Promise<State>,
  ) =>
  async (
    req: FastifyRequest<RouteGeneric>,
    res: FastifyReply,
  ): Promise<FastifyReply> => {
    try {
      const con = await createOrGetConnection();
      const state = stateFactory ? await stateFactory(req, con) : null;
      const userId = await extractUserId(req, state);
      const user = userId && (await fetchUser(userId, con));
      if (!user) {
        return res.status(404).send();
      }
      const feed = new RSS({
        title: `${title(user, state)} by daily.dev`,
        generator: 'daily.dev RSS',
        feed_url: `${process.env.URL_PREFIX}${req.raw.url}`,
        site_url: getUserProfileUrl(user.username!),
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
          url: `${getDiscussionLink(
            x.id,
          )}?utm_source=rss&utm_medium=bookmarks&utm_campaign=${userId}`,
          date: x.publishedAt,
          guid: x.id,
          description: '',
          categories: x.tagsStr?.split(','),
        }),
      );
      return res.type('application/rss+xml').send(feed.xml());
    } catch (originalError) {
      const err = originalError as TypeORMQueryFailedError;

      if (err.name === 'QueryFailedError' && err.code === '22P02') {
        return res.status(404).send();
      }
      throw err;
    }
  };

const extractFirstName = (user: User): string => user.name.split(' ')[0];

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  fastify.get('/', async (req, res): Promise<FastifyReply> => {
    return res.send();
  });

  // fastify.get(
  //   '/b/l/:listId',
  //   generateRSS<BookmarkList, { Params: { listId: string } }>(
  //     (req, list) => Promise.resolve(list?.userId),
  //     (user, list) => `${list.name} List`,
  //     'bookmark.createdAt',
  //     (req, user, builder) =>
  //       builder
  //         .addSelect('bookmark."createdAt"', 'publishedAt')
  //         .innerJoin(Bookmark, 'bookmark', 'post.id = bookmark.postId')
  //         .where('bookmark.listId = :listId', { listId: req.params.listId }),
  //     (req, con) =>
  //       con
  //         .getRepository(BookmarkList)
  //         .findOne(req.params.listId)
  //         .catch(() => null),
  //   ),
  // );

  fastify.get(
    '/b/:slug',
    generateRSS<Settings | null, { Params: { slug: string } }>(
      (req, settings) => Promise.resolve(settings?.userId || null),
      (user) => `${extractFirstName(user)}'s bookmarks`,
      'bookmark.createdAt',
      (req, user, builder) =>
        builder
          .addSelect('bookmark."createdAt"', 'publishedAt')
          .innerJoin(Bookmark, 'bookmark', 'post.id = bookmark.postId')
          .where('bookmark.userId = :userId', { userId: user.id }),
      (req, con) =>
        con
          .getRepository(Settings)
          .findOneBy({ bookmarkSlug: req.params.slug }),
    ),
  );

  // fastify.get(
  //   '/f/:feedId',
  //   generateRSS<Feed, { Params: { feedId: string } }>(
  //     (req, feed) => Promise.resolve(feed?.userId),
  //     (user) => `${extractFirstName(user)}'s Feed`,
  //     'post.createdAt',
  //     (req, user, builder) =>
  //       builder
  //         .addSelect('post."createdAt"', 'publishedAt')
  //         .where((subBuilder) =>
  //           whereSourcesInFeed(req.params.feedId, subBuilder, 'post'),
  //         )
  //         .andWhere((subBuilder) =>
  //           whereTagsInFeed(req.params.feedId, subBuilder, 'post'),
  //         ),
  //     (req, con) => con.getRepository(Feed).findOne(req.params.feedId),
  //   ),
  // );
}

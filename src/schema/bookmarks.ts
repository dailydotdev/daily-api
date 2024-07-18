import { IResolvers } from '@graphql-tools/utils';
import { ConnectionArguments } from 'graphql-relay';
import {
  GQLEmptyResponse,
  Page,
  PageGenerator,
  offsetPageGenerator,
  getSearchQuery,
  processSearchQuery,
} from './common';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { Bookmark, BookmarkList, Post } from '../entity';
import {
  base64,
  bookmarksFeedBuilder,
  FeedArgs,
  feedResolver,
  getCursorFromAfter,
} from '../common';
import { SelectQueryBuilder } from 'typeorm';
import { GQLPost } from './posts';
import { Connection } from 'graphql-relay';
import {
  cancelReminderWorkflow,
  runReminderWorkflow,
} from '../queue/bookmark/utils';

interface GQLAddBookmarkInput {
  postIds: string[];
}

export interface GQLBookmarkList {
  id: string;
  name: string;
}

export const typeDefs = /* GraphQL */ `
  type BookmarkList {
    """
    Unique identifier
    """
    id: String!

    """
    Name of the list
    """
    name: String!
  }

  type Bookmark {
    createdAt: DateTime
    remindAt: DateTime
  }

  type SearchBookmarksSuggestion {
    title: String!
  }

  type SearchBookmarksSuggestionsResults {
    query: String!
    hits: [SearchBookmarksSuggestion!]!
  }

  input AddBookmarkInput {
    """
    Post ids to bookmark
    """
    postIds: [ID]!
  }

  type Mutation {
    """
    Add new bookmarks
    """
    addBookmarks(data: AddBookmarkInput!): EmptyResponse! @auth

    """
    Set a reminder for a bookmark
    """
    setBookmarkReminder(
      """
      Post id to set reminder for
      """
      postId: ID!
      """
      UTC time to remind at
      """
      remindAt: DateTime
    ): EmptyResponse! @auth

    """
    Add or move bookmark to list
    """
    addBookmarkToList(id: ID!, listId: ID): EmptyResponse! @auth(premium: true)

    """
    Remove an existing bookmark
    """
    removeBookmark(id: ID!): EmptyResponse! @auth

    """
    Create a new bookmark list
    """
    createBookmarkList(name: String!): BookmarkList! @auth(premium: true)

    """
    Remove an existing bookmark list
    """
    removeBookmarkList(id: ID!): EmptyResponse! @auth(premium: true)

    """
    Rename an existing bookmark list
    """
    renameBookmarkList(id: ID!, name: String!): BookmarkList!
      @auth(premium: true)
  }

  type Query {
    """
    Get the user bookmarks feed
    """
    bookmarksFeed(
      """
      Time the pagination started to ignore new items
      """
      now: DateTime

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int

      """
      Return only unread posts
      """
      unreadOnly: Boolean = false

      """
      Id of the list to retrieve bookmarks from
      """
      listId: ID

      """
      Array of supported post types
      """
      supportedTypes: [String!]
    ): PostConnection! @auth

    """
    Get all the bookmark lists of the user
    """
    bookmarkLists: [BookmarkList!]! @auth(premium: true)

    """
    Get suggestions for search bookmarks query
    """
    searchBookmarksSuggestions(
      """
      The query to search for
      """
      query: String!
    ): SearchBookmarksSuggestionsResults!

    """
    Search through users bookmarks
    """
    searchBookmarks(
      """
      The query to search for
      """
      query: String!

      """
      Time the pagination started to ignore new items
      """
      now: DateTime

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int

      """
      Return only unread posts
      """
      unreadOnly: Boolean = false

      """
      Id of the list to retrieve bookmarks from
      """
      listId: ID

      """
      Array of supported post types
      """
      supportedTypes: [String!]
    ): PostConnection! @auth
  }
`;

interface BookmarksArgs extends ConnectionArguments {
  now: Date;
  unreadOnly: boolean;
  listId: string;
  supportedTypes?: string[];
}

interface BookmarkPage extends Page {
  limit: number;
  timestamp?: Date;
}

const bookmarkPageGenerator: PageGenerator<
  GQLPost,
  ConnectionArguments,
  BookmarkPage
> = {
  connArgsToPage: ({ first, after }: FeedArgs) => {
    const cursor = getCursorFromAfter(after);
    const limit = Math.min(first || 30, 50);
    if (cursor) {
      return { limit, timestamp: new Date(parseInt(cursor)) };
    }
    return { limit };
  },
  nodeToCursor: (page, args, node) => {
    return base64(`time:${node.bookmarkedAt.getTime()}`);
  },
  hasNextPage: (page, nodesSize) => page.limit === nodesSize,
  hasPreviousPage: (page) => !!page.timestamp,
};

const applyBookmarkPaging = (
  ctx: Context,
  args,
  page: BookmarkPage,
  builder: SelectQueryBuilder<Post>,
): SelectQueryBuilder<Post> => {
  let newBuilder = builder
    .limit(page.limit)
    .orderBy('bookmark.createdAt', 'DESC');
  if (page.timestamp) {
    newBuilder = newBuilder.andWhere('bookmark."createdAt" < :timestamp', {
      timestamp: page.timestamp,
    });
  }
  return newBuilder;
};

const searchResolver = feedResolver(
  (
    ctx,
    { query, unreadOnly, listId = null }: BookmarksArgs & { query: string },
    builder,
    alias,
  ) => bookmarksFeedBuilder(ctx, unreadOnly, listId, builder, alias, query),
  offsetPageGenerator(30, 50),
  (ctx, args, page, builder) => builder.limit(page.limit).offset(page.offset),
  { removeHiddenPosts: true, removeBannedPosts: false },
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Mutation: {
    addBookmarks: async (
      source,
      { data }: { data: GQLAddBookmarkInput },
      ctx,
    ): Promise<GQLEmptyResponse> => {
      const [query, params] = ctx.con
        .createQueryBuilder()
        .select('id', 'postId')
        .addSelect(`'${ctx.userId}'`, 'userId')
        .from(Post, 'post')
        .where('post.id IN (:...postIds)', { postIds: data.postIds })
        .getQueryAndParameters();
      await ctx.con.query(
        `insert into bookmark("postId", "userId") ${query} on conflict do nothing`,
        params,
      );
      return { _: true };
    },
    addBookmarkToList: async (
      source,
      { id, listId = null }: { id: string; listId?: string },
      ctx,
    ): Promise<GQLEmptyResponse> => {
      if (listId) {
        await ctx.con
          .getRepository(BookmarkList)
          .findOneByOrFail({ userId: ctx.userId, id: listId });
      }
      await ctx.con
        .getRepository(Bookmark)
        .createQueryBuilder()
        .insert()
        .into(Bookmark)
        .values([{ userId: ctx.userId, postId: id, listId }])
        .onConflict(
          `("postId", "userId") DO UPDATE SET "listId" = EXCLUDED."listId"`,
        )
        .execute();
      return { _: true };
    },
    removeBookmark: async (
      source,
      { id }: { id: string },
      ctx,
    ): Promise<GQLEmptyResponse> => {
      const repo = ctx.con.getRepository(Bookmark);
      const bookmark = await repo.findOneBy({ userId: ctx.userId, postId: id });

      if (bookmark.remindAt) {
        cancelReminderWorkflow({
          userId: ctx.userId,
          postId: id,
          remindAt: bookmark.remindAt.getTime(),
        });
      }

      await ctx.con.getRepository(Bookmark).delete({
        postId: id,
        userId: ctx.userId,
      });
      return { _: true };
    },
    createBookmarkList: async (
      source,
      { name }: { name: string },
      ctx,
    ): Promise<GQLBookmarkList> =>
      ctx.con.getRepository(BookmarkList).save({
        name,
        userId: ctx.userId,
      }),
    removeBookmarkList: async (
      source,
      { id }: { id: string },
      ctx,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.getRepository(BookmarkList).delete({
        id,
        userId: ctx.userId,
      });
      return { _: true };
    },
    renameBookmarkList: async (
      source,
      { id, name }: { id: string; name: string },
      ctx,
    ): Promise<GQLBookmarkList> => {
      const repo = ctx.con.getRepository(BookmarkList);
      const list = await repo.findOneByOrFail({ userId: ctx.userId, id });
      list.name = name;
      return repo.save(list);
    },
    setBookmarkReminder: async (
      source,
      { remindAt, postId }: { remindAt: Date; postId: string },
      { con, userId },
    ): Promise<GQLEmptyResponse> => {
      if (!userId) {
        return { _: null };
      }

      await con.transaction(async (manager) => {
        const repo = manager.getRepository(Bookmark);
        const bookmark = await repo.findOneBy({ userId, postId });

        if (bookmark) {
          const result = await repo.update({ userId, postId }, { remindAt });
          if (result.affected === 0) {
            return;
          }
        } else {
          await repo.insert({ userId, postId, remindAt });
        }

        if (remindAt) {
          if (bookmark?.remindAt) {
            cancelReminderWorkflow({
              userId,
              postId,
              remindAt: bookmark.remindAt.getTime(),
            });
          }

          runReminderWorkflow({ userId, postId, remindAt: remindAt.getTime() });
          return;
        }

        if (!bookmark.remindAt) {
          return;
        }

        cancelReminderWorkflow({
          userId,
          postId,
          remindAt: bookmark.remindAt.getTime(),
        });
      });

      return { _: null };
    },
  },
  Query: {
    bookmarksFeed: feedResolver(
      (ctx, { unreadOnly, listId = null }: BookmarksArgs, builder, alias) =>
        bookmarksFeedBuilder(ctx, unreadOnly, listId, builder, alias),
      bookmarkPageGenerator,
      applyBookmarkPaging,
      { removeHiddenPosts: false, removeBannedPosts: false },
    ),
    bookmarkLists: (source, args, ctx, info): Promise<GQLBookmarkList[]> =>
      ctx.loader.loadMany<BookmarkList>(
        BookmarkList,
        { userId: ctx.userId },
        info,
        {
          order: { name: 'ASC' },
        },
      ),
    searchBookmarksSuggestions: async (
      source,
      { query }: { query: string },
      ctx,
    ) => {
      const hits: { title: string }[] = await ctx.con.query(
        `
          WITH search AS (${getSearchQuery('$2')})
          select ts_headline(title, search.query,
                             'StartSel = <strong>, StopSel = </strong>') as title
          from post
                 INNER JOIN bookmark ON bookmark."postId" = post.id AND
                                        bookmark."userId" = $1,
               search
          where tsv @@ search.query
          order by views desc
            limit 5;
        `,
        [ctx.userId, processSearchQuery(query)],
      );
      return {
        query,
        hits,
      };
    },
    searchBookmarks: async (
      source,
      args: FeedArgs & { query: string },
      ctx,
      info,
    ): Promise<Connection<GQLPost> & { query: string }> => {
      const res = await searchResolver(source, args, ctx, info);
      return {
        ...res,
        query: args.query,
      };
    },
  },
});

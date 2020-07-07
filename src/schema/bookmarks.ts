import { gql, IResolvers } from 'apollo-server-fastify';
import { ConnectionArguments } from 'graphql-relay';
import { GQLEmptyResponse } from './common';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { Bookmark, BookmarkList } from '../entity';
import { bookmarksFeedBuilder, feedResolver } from '../common';

interface GQLAddBookmarkInput {
  postIds: string[];
}

interface GQLBookmarkList {
  id: string;
  name: string;
}

export const typeDefs = gql`
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

  input AddBookmarkInput {
    """
    Post ids to bookmark
    """
    postIds: [ID!]!
  }

  type Mutation {
    """
    Add new bookmarks
    """
    addBookmarks(data: AddBookmarkInput!): EmptyResponse! @auth

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
      now: DateTime!

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
    ): PostConnection! @auth

    """
    Get all the bookmark lists of the user
    """
    bookmarkLists: [BookmarkList!]! @auth(premium: true)
  }
`;

interface BookmarksArgs extends ConnectionArguments {
  now: Date;
  unreadOnly: boolean;
  listId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Mutation: {
    addBookmarks: async (
      source,
      { data }: { data: GQLAddBookmarkInput },
      ctx,
    ): Promise<GQLEmptyResponse> => {
      const repo = ctx.con.getRepository(Bookmark);
      const values = data.postIds.map((id) =>
        repo.create({
          userId: ctx.userId,
          postId: id,
        }),
      );
      await ctx.con
        .createQueryBuilder()
        .insert()
        .into(Bookmark)
        .values(values)
        .onConflict(`("postId", "userId") DO NOTHING`)
        .execute();
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
          .findOneOrFail({ userId: ctx.userId, id: listId });
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
      const list = await repo.findOneOrFail({ userId: ctx.userId, id });
      list.name = name;
      return repo.save(list);
    },
  },
  Query: {
    bookmarksFeed: feedResolver(
      (ctx, { now, unreadOnly, listId = null }: BookmarksArgs, builder) =>
        bookmarksFeedBuilder(ctx, now, unreadOnly, listId, builder),
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
  },
});

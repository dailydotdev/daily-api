import {
  Arg,
  Authorized,
  Ctx,
  Field,
  ID,
  InputType,
  Mutation,
  Resolver,
} from 'type-graphql';
import { Context } from '../Context';
import { Bookmark, EmptyResponse, Post } from '../entity';
import {
  RelayedQuery,
  RelayLimitOffset,
  RelayLimitOffsetArgs,
} from 'auto-relay';
import { SelectQueryBuilder } from 'typeorm';

@InputType()
export class AddBookmarkInput {
  @Field(() => ID, { description: 'Post ids to bookmark' })
  postIds: string[];
}

@Resolver()
export class BookmarkResolver {
  @Mutation(() => EmptyResponse, { description: 'Add new bookmarks' })
  @Authorized()
  async addBookmarks(
    @Arg('data') data: AddBookmarkInput,
    @Ctx() ctx: Context,
  ): Promise<EmptyResponse> {
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
    return new EmptyResponse();
  }

  @Mutation(() => EmptyResponse, { description: 'Remove an existing bookmark' })
  @Authorized()
  async removeBookmark(
    @Arg('id', () => ID) id: string,
    @Ctx() ctx: Context,
  ): Promise<EmptyResponse> {
    await ctx.con.getRepository(Bookmark).delete({
      postId: id,
      userId: ctx.userId,
    });
    return new EmptyResponse();
  }

  @RelayedQuery(() => Post, {
    description: 'Get the user bookmarks feed',
  })
  @Authorized()
  async bookmarks(
    @Ctx() ctx: Context,
    @Arg('now') now: Date,
    @RelayLimitOffset() { limit, offset }: RelayLimitOffsetArgs,
  ): Promise<[number, Post[]]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const from = (builder: SelectQueryBuilder<any>): SelectQueryBuilder<any> =>
      builder
        .select(['"postId"', '"createdAt"'])
        .addSelect('count(*) OVER() AS count')
        .from(Bookmark, 'bookmark')
        .orderBy('"createdAt"', 'DESC')
        .where('"userId" = :userId')
        .andWhere('"createdAt" <= :now')
        .limit(limit)
        .offset(offset);

    const res = await ctx.con
      .createQueryBuilder()
      .select(['post.*', 'res.count'])
      .from(from, 'res')
      .innerJoin(Post, 'post', 'post.id = res."postId"')
      .setParameters({ userId: ctx.userId, now })
      .orderBy('res."createdAt"', 'DESC')
      .getRawMany();

    if (!res.length) {
      return [0, []];
    }

    return [
      parseInt(res[0].count),
      res.map((x: object) => ctx.getRepository(Post).create(x)),
    ];
  }
}

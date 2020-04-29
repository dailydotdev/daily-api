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
import { Bookmark, EmptyResponse } from '../entity';

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
}

import { DataSource } from 'typeorm';
import { Post, PostReport, Source, UserPost } from '../entity';
import {
  NotFoundError,
  TypeOrmError,
  TypeORMQueryFailedError,
} from '../errors';
import {
  postReportReasonsMap,
  PostReportReasonType,
  ReportReason,
  sourceReportReasonsMap,
  SourceReportReasonType,
} from '../entity/common';
import { ValidationError } from 'apollo-server-errors';
import { Context } from '../Context';
import { SourceReport } from '../entity/sources/SourceReport';
import { ensureSourcePermissions } from '../schema/sources';

interface SaveHiddenPostArgs {
  postId: string;
  userId: string;
}

const saveHiddenPost = async (
  con: DataSource,
  { postId, userId }: SaveHiddenPostArgs,
): Promise<boolean> => {
  try {
    await con.transaction(async (entityManager) => {
      await entityManager.getRepository(UserPost).save({
        postId,
        userId,
        hidden: true,
      });
    });
  } catch (originalError) {
    const err = originalError as TypeORMQueryFailedError;

    // Foreign key violation
    if (err?.code === TypeOrmError.FOREIGN_KEY) {
      throw new NotFoundError('Post not found');
    }
    // Unique violation
    if (err?.code !== TypeOrmError.DUPLICATE_ENTRY) {
      throw err;
    }
  }
  return true;
};

interface BaseReportArgs<T extends ReportReason> {
  id: string;
  reason: T;
  comment?: string;
  ctx: Context;
}

interface PostReportArgs extends BaseReportArgs<PostReportReasonType> {
  tags?: string[];
}

export const reportPost = async ({
  ctx,
  id,
  tags,
  reason,
  comment,
}: PostReportArgs) => {
  if (!(reason in postReportReasonsMap)) {
    throw new ValidationError('Reason is invalid');
  }

  if (reason === 'IRRELEVANT' && !tags?.length) {
    throw new ValidationError('You must include the irrelevant tags!');
  }

  const added = await saveHiddenPost(ctx.con, {
    userId: ctx.userId,
    postId: id,
  });

  if (added) {
    const post = await ctx.getRepository(Post).findOneByOrFail({ id });
    await ensureSourcePermissions(ctx, post.sourceId);
    if (!post.banned) {
      try {
        await ctx.getRepository(PostReport).insert({
          postId: id,
          userId: ctx.userId,
          reason,
          comment,
          tags,
        });
      } catch (originalError) {
        const err = originalError as TypeORMQueryFailedError;

        if (err?.code !== TypeOrmError.DUPLICATE_ENTRY) {
          throw new Error('Failed to save report to database');
        }
      }
    }
  }
};

export const reportSource = async ({
  ctx,
  id,
  reason,
  comment,
}: BaseReportArgs<SourceReportReasonType>) => {
  if (!(reason in sourceReportReasonsMap)) {
    throw new ValidationError('Reason is invalid');
  }

  await ctx.getRepository(Source).findOneByOrFail({ id });
  await ensureSourcePermissions(ctx, id);

  await ctx.getRepository(SourceReport).insert({
    sourceId: id,
    userId: ctx.userId,
    reason,
    comment,
  });
};

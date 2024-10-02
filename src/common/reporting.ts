import { DataSource } from 'typeorm';
import { Post, PostReport, UserPost, Comment } from '../entity';
import {
  NotFoundError,
  TypeOrmError,
  TypeORMQueryFailedError,
} from '../errors';
import {
  postReportReasonsMap,
  reportCommentReasonsMap,
  ReportEntity,
  ReportReason,
  sourceReportReasonsMap,
} from '../entity/common';
import { ValidationError } from 'apollo-server-errors';
import { AuthContext } from '../Context';
import { SourceReport } from '../entity/sources/SourceReport';
import { ensureSourcePermissions } from '../schema/sources';
import { CommentReport } from '../entity/CommentReport';

interface SaveHiddenPostArgs {
  postId: string;
  userId: string;
}

export const saveHiddenPost = async (
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

interface BaseReportArgs {
  id: string;
  reason: ReportReason;
  comment?: string;
  ctx: AuthContext;
}

interface PostReportArgs extends BaseReportArgs {
  tags?: string[];
}

type ReportFunction = (params: BaseReportArgs) => Promise<void>;

export const reportPost = async ({
  ctx,
  id,
  tags,
  reason,
  comment,
}: PostReportArgs) => {
  if (!postReportReasonsMap.has(reason)) {
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

export const reportComment = async ({
  ctx,
  id,
  reason,
  comment,
}: BaseReportArgs) => {
  if (!reportCommentReasonsMap.has(reason)) {
    throw new ValidationError('Reason is invalid');
  }

  await ctx
    .getRepository(Comment)
    .findOneOrFail({ where: { id }, select: ['id'] });

  try {
    await ctx.getRepository(CommentReport).insert({
      commentId: id,
      userId: ctx.userId,
      reason,
      note: comment,
    });
  } catch (originalError) {
    const err = originalError as TypeORMQueryFailedError;

    if (err?.code !== TypeOrmError.DUPLICATE_ENTRY) {
      throw new Error('Failed to save report to database');
    }
  }
};

export const reportSource = async ({
  ctx,
  id,
  reason,
  comment,
}: BaseReportArgs) => {
  if (!sourceReportReasonsMap.has(reason)) {
    throw new ValidationError('Reason is invalid');
  }

  await ensureSourcePermissions(ctx, id);

  await ctx.getRepository(SourceReport).insert({
    sourceId: id,
    userId: ctx.userId,
    reason,
    comment,
  });
};

export const reportFunctionMap: Record<ReportEntity, ReportFunction> = {
  [ReportEntity.Post]: reportPost,
  [ReportEntity.Comment]: reportComment,
  [ReportEntity.Source]: reportSource,
};

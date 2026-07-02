import { ValidationError } from 'apollo-server-errors';
import type { DataSource, EntityManager } from 'typeorm';
import { Post } from '../entity/posts/Post';

type ConnectionManager = DataSource | EntityManager;

type PostScheduleInput = Date | string | number | null | undefined;
type PostScheduleFlagsInput = {
  flags?: Post['flags'] | string | null;
};

export type ScheduledPostPublishParams = {
  postId: string;
  scheduledAt: string;
};

export const getPostScore = (date: Date): number =>
  Math.floor(date.getTime() / (1000 * 60));

export const parsePostScheduledAt = (
  scheduledAt: PostScheduleInput,
): Date | null => {
  if (!scheduledAt) {
    return null;
  }

  const date = new Date(scheduledAt);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('Invalid scheduled time');
  }

  return date;
};

export const validatePostScheduledAt = (
  scheduledAt: PostScheduleInput,
): Date | null => {
  const date = parsePostScheduledAt(scheduledAt);

  if (date && date.getTime() <= Date.now()) {
    throw new ValidationError('Scheduled time must be in the future');
  }

  return date;
};

export const getPostScheduledAt = ({
  flags,
}: PostScheduleFlagsInput): Date | null => {
  const parsedFlags =
    typeof flags === 'string' ? JSON.parse(flags || '{}') : flags;

  return parsePostScheduledAt(parsedFlags?.scheduledAt);
};

export const getScheduledPostFlags = (scheduledAt: Date) => ({
  scheduledAt: scheduledAt.toISOString(),
  visible: false,
});

export const getPublishedPostFlagsStatement = (): (() => string) => {
  const flags = JSON.stringify({ visible: true });

  return () => `(flags - 'scheduledAt') || '${flags}'`;
};

export const publishScheduledPost = async ({
  con,
  postId,
  scheduledAt,
}: {
  con: ConnectionManager;
  postId: string;
  scheduledAt: PostScheduleInput;
}): Promise<void> => {
  const expectedScheduledAt = parsePostScheduledAt(scheduledAt);

  if (!expectedScheduledAt) {
    return;
  }

  const post = await con.getRepository(Post).findOne({
    select: ['id', 'flags', 'visible', 'deleted', 'banned'],
    where: { id: postId },
  });

  if (!post || post.visible || post.deleted || post.banned) {
    return;
  }

  const currentScheduledAt = getPostScheduledAt(post);

  if (
    !currentScheduledAt ||
    currentScheduledAt.getTime() !== expectedScheduledAt.getTime() ||
    currentScheduledAt.getTime() > Date.now()
  ) {
    return;
  }

  const now = new Date();

  await con.getRepository(Post).update(
    {
      id: post.id,
      visible: false,
      deleted: false,
      banned: false,
    },
    {
      visible: true,
      visibleAt: now,
      createdAt: now,
      score: getPostScore(now),
      flags: getPublishedPostFlagsStatement(),
    },
  );
};

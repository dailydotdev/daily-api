import { ValidationError } from 'apollo-server-errors';
import type { DataSource, EntityManager } from 'typeorm';
import { Post } from '../entity/posts/Post';
import { ONE_DAY_IN_SECONDS } from './constants';

type ConnectionManager = DataSource | EntityManager;

type PostScheduleInput = Date | string | number | null | undefined;
type PostScheduleFlagsInput = {
  flags?: Post['flags'] | null;
};
const MAX_POST_SCHEDULE_DAYS = 14;

export type ScheduledPostPublishParams = {
  postId: string;
  scheduledAt: string;
};

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

  if (
    date &&
    date.getTime() >
      Date.now() + MAX_POST_SCHEDULE_DAYS * ONE_DAY_IN_SECONDS * 1000
  ) {
    throw new ValidationError(
      `Scheduled time must be within ${MAX_POST_SCHEDULE_DAYS} days`,
    );
  }

  return date;
};

export const getPostScheduledAt = ({
  flags,
}: PostScheduleFlagsInput): Date | null => {
  return parsePostScheduledAt(flags?.scheduledAt);
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
    },
    {
      visible: true,
      visibleAt: now,
      createdAt: now,
      flags: getPublishedPostFlagsStatement(),
    },
  );
};

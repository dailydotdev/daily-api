import { DataSource, EntityManager, MoreThan } from 'typeorm';
import { Comment, Post, User } from '../entity';
import { remoteConfig } from '../remoteConfig';
import { subDays } from 'date-fns';
import { GraphQLError } from 'graphql/index';

export class RateLimitError extends GraphQLError {
  extensions = {};
  message = '';

  constructor({
    msBeforeNextReset = 0,
    message,
  }: {
    msBeforeNextReset?: number;
    message?: string;
  }) {
    const seconds = (msBeforeNextReset / 1000).toFixed(0);
    message = message ?? `Too many requests, please try again in ${seconds}s`;
    super(message);

    this.message = message;
    this.extensions = { code: 'RATE_LIMITED' };
  }
}

const ensureReputationBasedRateLimit = async (
  con: DataSource | EntityManager,
  userId: string,
  count: Promise<number>,
  countThreshold: number,
  errorMessage: string,
): Promise<void> => {
  const [user, countValue] = await Promise.all([
    con
      .getRepository(User)
      .findOneOrFail({ select: ['id', 'reputation'], where: { id: userId } }),
    count,
  ]);

  if (
    remoteConfig.vars?.rateLimitReputationThreshold &&
    user.reputation > remoteConfig.vars.rateLimitReputationThreshold
  ) {
    return;
  }

  if (countValue >= countThreshold) {
    throw new RateLimitError({
      message: errorMessage,
    });
  }
};

export const ensurePostRateLimit = async (
  con: DataSource | EntityManager,
  userId: string,
): Promise<void> => {
  return ensureReputationBasedRateLimit(
    con,
    userId,
    con.getRepository(Post).countBy({
      authorId: userId,
      createdAt: MoreThan(subDays(new Date(), 1)),
    }),
    remoteConfig.vars?.postRateLimit ?? 0,
    `Take a break. You already posted enough`,
  );
};

export const ensureCommentRateLimit = async (
  con: DataSource | EntityManager,
  userId: string,
): Promise<void> => {
  return ensureReputationBasedRateLimit(
    con,
    userId,
    con.getRepository(Comment).countBy({
      userId: userId,
      createdAt: MoreThan(subDays(new Date(), 1)),
    }),
    remoteConfig.vars?.commentRateLimit ?? 0,
    `Take a break. You already commented enough`,
  );
};

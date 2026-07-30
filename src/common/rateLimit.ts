import { DataSource, EntityManager, MoreThan } from 'typeorm';
import { Comment, Post, User } from '../entity';
import { SourceMember } from '../entity/SourceMember';
import { sourceRoleRank } from '../roles';
import { remoteConfig } from '../remoteConfig';
import { subDays } from 'date-fns';
import { GraphQLError } from 'graphql/index';
import { isPlusMember } from '../paddle';
import { queryReadReplica } from './queryReadReplica';

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
  isExempt: Promise<boolean> = Promise.resolve(false),
): Promise<void> => {
  const [user, countValue, exempt] = await Promise.all([
    con.getRepository(User).findOneOrFail({
      select: ['id', 'reputation', 'subscriptionFlags'],
      where: { id: userId },
    }),
    count,
    isExempt,
  ]);

  if (exempt || isPlusMember(user.subscriptionFlags?.cycle)) {
    return;
  }

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

export const isPrivilegedSquadMember = async (
  con: DataSource,
  { userId, sourceId }: { userId?: string; sourceId?: string },
): Promise<boolean> => {
  if (!userId || !sourceId) {
    return false;
  }

  const member = await queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager.getRepository(SourceMember).findOne({
      select: ['role'],
      where: { userId, sourceId },
    }),
  );

  return !!member && sourceRoleRank[member.role] >= sourceRoleRank.moderator;
};

export const ensurePostRateLimit = async (
  con: DataSource,
  userId: string,
  sourceId?: string,
): Promise<void> => {
  return ensureReputationBasedRateLimit(
    con,
    userId,
    con.getRepository(Post).countBy({
      authorId: userId,
      createdAt: MoreThan(subDays(new Date(), 1)),
      deleted: false,
    }),
    remoteConfig.vars?.postRateLimit ?? 0,
    `Take a break. You already posted enough`,
    isPrivilegedSquadMember(con, { userId, sourceId }),
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

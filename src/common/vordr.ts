import { isInSubnet, isIP } from 'is-in-subnet';
import emojiRegex from 'emoji-regex';
import { User } from '../entity';
import { logger } from '../logger';
import { counters } from '../telemetry';
import { Brackets, DataSource, EntityManager } from 'typeorm';
import { isNullOrUndefined } from './object';
import { FastifyRequest } from 'fastify';
import { remoteConfig } from '../remoteConfig';

export const validateVordrIPs = (ip: string): boolean =>
  !!isIP(ip) && isInSubnet(ip, remoteConfig.vars.vordrIps ?? []);

export const validateVordrWords = (content?: string): boolean => {
  if (!content) {
    return false;
  }

  const lowerCaseContent = content.toLowerCase();
  return !!remoteConfig.vars.vordrWords?.some((word) =>
    lowerCaseContent.includes(word),
  );
};

export const validatePostTitle = (title?: string): boolean => {
  if (!title) {
    return false;
  }

  // Check for vordr words in title
  const vordrWordsTitle = remoteConfig.vars.vordrWordsPostTitle;
  if (vordrWordsTitle && vordrWordsTitle.length > 0) {
    const lowerCaseTitle = title.toLowerCase();
    if (vordrWordsTitle.some((word) => lowerCaseTitle.includes(word))) {
      return true;
    }
  }

  // Check for emojis in title
  const regex = emojiRegex();
  return regex.test(title);
};

export enum VordrFilterType {
  Comment = 'comment',
  Post = 'post',
  PostModeration = 'post_moderation',
  Submission = 'submission',
}

type CheckWithVordrInput = {
  id: string;
  type: VordrFilterType;
  content?: string;
  title?: string;
};

type CheckWithVordrContext = {
  userId?: string;
  con: DataSource | EntityManager;
  req?: Pick<FastifyRequest, 'ip'>;
};

export const checkWithVordr = async (
  { id, type, content, title }: CheckWithVordrInput,
  { userId, con, req }: CheckWithVordrContext,
): Promise<boolean> => {
  if (req && validateVordrIPs(req.ip)) {
    logger.info(
      { id, type, userId, ip: req.ip },
      `Prevented ${type} because IP is in Vordr subnet`,
    );
    counters?.api?.vordr?.add(1, { reason: 'vordr_ip', type: type });
    return true;
  }

  if (validateVordrWords(content)) {
    logger.info(
      { id, type, userId },
      `Prevented ${type} because it contains spam`,
    );
    counters?.api?.vordr?.add(1, { reason: 'vordr_word', type: type });
    return true;
  }

  // Check post title for vordr conditions
  if (title && validatePostTitle(title)) {
    logger.info(
      { id, type, userId },
      `Prevented ${type} because title contains banned content`,
    );
    counters?.api?.vordr?.add(1, { reason: 'vordr_title', type: type });
    return true;
  }

  if (!userId) {
    return false;
  }

  const user: Pick<User, 'flags' | 'reputation'> | null = await con
    .getRepository(User)
    .findOne({
      select: ['flags', 'reputation'],
      where: { id: userId },
    });

  if (!user) {
    logger.error({ id, type, userId }, `Failed to fetch user for ${type}`);
    return true;
  }

  if (user.flags?.vordr) {
    logger.info({ id, type, userId }, `Vordr prevented user from ${type}ing`);
    counters?.api?.vordr?.add(1, { reason: 'vordr', type: type });
    return true;
  }

  if (
    typeof user.flags?.trustScore === 'number' &&
    user.flags.trustScore <= 0
  ) {
    logger.info(
      { id, type, userId },
      `Prevented ${type} because user has a score of 0`,
    );
    counters?.api?.vordr?.add(1, { reason: 'score', type: type });
    return true;
  }

  if (user.reputation < 10) {
    logger.info(
      { id, type, userId },
      `Prevented ${type} because user has low reputation`,
    );
    counters?.api?.vordr?.add(1, { reason: 'reputation', type: type });
    return true;
  }

  return false;
};

export const whereVordrFilter = (alias: string, userId?: string) =>
  new Brackets((qb) => {
    const vordrFilter = `COALESCE((${alias}.flags ->> 'vordr')::boolean, false) = false`;
    isNullOrUndefined(userId)
      ? qb.where(vordrFilter)
      : qb
          .where(`${alias}.userId = :userId`, {
            userId: userId,
          })
          .orWhere(vordrFilter);
  });

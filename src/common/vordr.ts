import { isInSubnet, isIP } from 'is-in-subnet';
import { User } from '../entity';
import { logger } from '../logger';
import { counters } from '../telemetry';
import { Brackets, DataSource, EntityManager } from 'typeorm';
import { isNullOrUndefined } from './object';
import { FastifyRequest } from 'fastify';

const vordrIPs =
  process.env.VORDR_IPS?.split(',').filter((ip) => Boolean(ip)) || [];

const vordrWords =
  process.env.VORDR_WORDS?.split(',')
    .filter((word) => Boolean(word))
    .map((word) => word.toLowerCase()) || [];

export const validateVordrIPs = (ip: string): boolean =>
  isIP(ip) && isInSubnet(ip, vordrIPs);

export const validateVordrWords = (content: string): boolean => {
  if (!content) {
    return false;
  }

  const lowerCaseContent = content.toLowerCase();
  return vordrWords.some((word) => lowerCaseContent.includes(word));
};

export enum VordrFilterType {
  Comment = 'comment',
  Post = 'post',
  Submission = 'submission',
}

type CheckWithVordrInput = {
  id: string;
  type: VordrFilterType;
  content?: string;
};

type CheckWithVordrContext = {
  userId: string;
  con: DataSource | EntityManager;
  req: Pick<FastifyRequest, 'ip'>;
};

export const checkWithVordr = async (
  { id, type, content }: CheckWithVordrInput,
  { userId, con, req }: CheckWithVordrContext,
): Promise<boolean> => {
  if (validateVordrIPs(req.ip)) {
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

  const user: Pick<User, 'flags' | 'reputation'> = await con
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

  if (user.flags?.trustScore <= 0) {
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

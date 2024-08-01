import { isInSubnet, isIP } from 'is-in-subnet';
import { Context } from '../Context';
import { Comment, User } from '../entity';
import { logger } from '../logger';
import { counters } from '../telemetry';
import { Brackets } from 'typeorm';

const vordrIPs =
  process.env.VORDR_IPS?.split(',').filter((ip) => Boolean(ip)) || [];

const vordrWords =
  process.env.VORDR_WORDS?.split(',')
    .filter((word) => Boolean(word))
    .map((word) => word.toLowerCase()) || [];

export const validateVordrIPs = (ip: string): boolean =>
  isIP(ip) && isInSubnet(ip, vordrIPs);

export const validateVordrWords = (content: string): boolean =>
  vordrWords.some((word) => content.toLowerCase().includes(word));

export const checkWithVordr = async (
  comment: Comment,
  { userId, con, req }: Context,
): Promise<boolean> => {
  if (validateVordrIPs(req.ip)) {
    logger.info(
      { commentId: comment.id, userId, ip: req.ip },
      'Prevented comment because IP is in Vordr subnet',
    );
    counters?.api?.preventComment?.add(1, { reason: 'vordr_ip' });
    return true;
  }

  if (validateVordrWords(comment.content)) {
    logger.info(
      { commentId: comment.id, userId },
      'Prevented comment because it contains spam',
    );
    counters?.api?.preventComment?.add(1, { reason: 'vordr_word' });
    return true;
  }

  const user: Pick<User, 'flags' | 'reputation'> = await con
    .getRepository(User)
    .createQueryBuilder('user')
    .select(['flags', 'reputation'])
    .where('user.id = :id', { id: userId })
    .getRawOne();

  if (!user) {
    logger.error(
      { commentId: comment.id, userId },
      'Failed to fetch user for comment',
    );
    return true;
  }

  if (user.flags?.vordr) {
    logger.info(
      { commentId: comment.id, userId },
      'Vordr prevented user from commenting',
    );
    counters?.api?.preventComment?.add(1, { reason: 'vordr' });
    return true;
  }

  if (!user.flags?.trustScore || user.flags?.trustScore <= 0) {
    logger.info(
      { commentId: comment.id, userId },
      'Prevented comment because user has a score of 0',
    );
    counters?.api?.preventComment?.add(1, { reason: 'score' });
    return true;
  }

  if (user.reputation < 10) {
    logger.info(
      { commentId: comment.id, userId },
      'Prevented comment because user has low reputation',
    );
    counters?.api?.preventComment?.add(1, { reason: 'reputation' });
    return true;
  }

  return false;
};

export const whereVordrFilter = (alias: string, userId: string) =>
  new Brackets((qb) => {
    qb.where(`${alias}.userId = :userId`, {
      userId: userId,
    }).orWhere(`(${alias}.flags ->> 'vordr')::boolean = false`);
  });

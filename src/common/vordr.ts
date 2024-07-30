import { isInSubnet, isIP } from 'is-in-subnet';
import { Context } from '../Context';
import { Comment, User } from '../entity';
import { logger } from '../logger';
import { counters } from '../telemetry';

const vordrIPs =
  process.env.VORDR_IPS?.split(',').filter((ip) => Boolean(ip)) || [];

const vordrWords =
  process.env.VORDR_WORDS?.split(',').filter((word) => Boolean(word)) || [];

export const validateVordrIPs = (ip: string): boolean =>
  isIP(ip) && isInSubnet(ip, vordrIPs);

export const checkWithVordr = async (
  comment: Comment,
  { userId, con, req }: Context,
): Promise<boolean> => {
  const user = await con.getRepository(User).findOneByOrFail({ id: userId });

  if (user.flags.vordr) {
    logger.info(
      { commentId: comment.id, userId },
      'Vordr prevented user from commenting',
    );
    counters?.api?.preventComment?.add(1, { reason: 'vordr' });
    return true;
  }

  if (user.flags.trustScore <= 0) {
    logger.info(
      { commentId: comment.id, userId },
      'Prevented comment because user has a score of 0',
    );
    counters?.api?.preventComment?.add(1, { reason: 'score' });
    return true;
  }

  if (validateVordrIPs(req.ip)) {
    logger.info(
      { commentId: comment.id, userId, ip: req.ip },
      'Prevented comment because IP is in Vordr subnet',
    );
    counters?.api?.preventComment?.add(1, { reason: 'vordr_ip' });
    return true;
  }

  if (
    vordrWords.some((word) =>
      comment.content.toLowerCase().includes(word.toLowerCase()),
    )
  ) {
    logger.info(
      { commentId: comment.id, userId },
      'Prevented comment because it contains spam',
    );
    counters?.api?.preventComment?.add(1, { reason: 'vordr_word' });
    return true;
  }

  return false;
};

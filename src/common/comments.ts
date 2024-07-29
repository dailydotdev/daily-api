import { Context } from '../Context';
import { User } from '../entity';
import { logger } from '../logger';
import { counters } from '../telemetry';

export const checkWithVordr = async (
  commentId: string,
  { userId, con }: Context,
): Promise<boolean> => {
  const user = await con.getRepository(User).findOneByOrFail({ id: userId });

  if (user.flags.vordr) {
    logger.info({ commentId, userId }, 'Vordr prevented user from commenting');
    counters?.api?.preventComment?.add(1, { reason: 'vordr' });
    return true;
  }

  if (user.flags.trustScore <= 0) {
    logger.info(
      { commentId, userId },
      'Prevented comment because user has a score of 0',
    );
    counters?.api?.preventComment?.add(1, { reason: 'score' });
    return true;
  }

  return false;
};

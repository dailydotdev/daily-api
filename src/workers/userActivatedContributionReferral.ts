import { ghostUser } from '../common';
import { awardReferralContribution } from '../common/contribution';
import type { ChangeObject } from '../types';
import type { User } from '../entity';
import { TypedWorker } from './worker';

const isActivated = (user: ChangeObject<User>): boolean =>
  !!user.infoConfirmed && !!user.emailConfirmed;

// Credits the referrer with giveback points the moment an invited friend
// "gets going" (confirms info + email). Fires once on that transition.
const worker: TypedWorker<'user-updated'> = {
  subscription: 'api.user-activated-contribution-referral',
  handler: async (message, con, log) => {
    try {
      const {
        data: { newProfile: user, user: oldUser },
      } = message;

      if (user.id === ghostUser.id || !user.referralId) {
        return;
      }

      if (!isActivated(user) || isActivated(oldUser)) {
        return;
      }

      const awarded = await awardReferralContribution({
        con: con.manager,
        referrerId: user.referralId,
        refereeId: user.id,
      });

      if (awarded) {
        log.info(
          { referrerId: user.referralId, refereeId: user.id },
          'awarded giveback referral contribution',
        );
      }
    } catch (_err) {
      const err = _err as Error;
      log.error({ err }, 'failed to award giveback referral contribution');
      throw err;
    }
  },
};

export default worker;

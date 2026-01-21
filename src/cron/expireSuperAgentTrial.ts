import { Cron } from './cron';
import { Organization } from '../entity/Organization';
import { SubscriptionStatus } from '../common/plus/subscription';

const cron: Cron = {
  name: 'expire-super-agent-trial',
  handler: async (con, logger) => {
    logger.debug('Checking for expired Super Agent trials...');

    const now = new Date();
    const orgRepo = con.getRepository(Organization);

    // Find organizations with expired trials using the index
    const expiredOrgs = await orgRepo
      .createQueryBuilder('org')
      .where(`org."recruiterSubscriptionFlags"->>'isTrialActive' = 'true'`)
      .andWhere(
        `(org."recruiterSubscriptionFlags"->>'trialExpiresAt')::timestamptz < :now`,
        { now },
      )
      .getMany();

    for (const org of expiredOrgs) {
      const flags = org.recruiterSubscriptionFlags || {};
      const originalPlan = flags.trialPlan;

      const updatedFlags = {
        ...flags,
        isTrialActive: false,
        trialExpiresAt: undefined,
        trialPlan: undefined,
        status: originalPlan ? flags.status : SubscriptionStatus.None,
      };

      await orgRepo.update(org.id, {
        recruiterSubscriptionFlags: updatedFlags,
      });

      logger.info(
        { organizationId: org.id, hadOriginalPlan: !!originalPlan },
        'Super Agent trial expired, downgraded',
      );
    }

    logger.info(
      { count: expiredOrgs.length },
      'Super Agent trial expiration complete',
    );
  },
};

export default cron;

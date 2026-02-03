import { FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { executeGraphql } from './public/graphqlExecutor';

interface UserAlerts {
  filter: boolean;
  rankLastSeen: string;
  myFeed: string;
  companionHelper: boolean;
  lastChangelog: string;
  lastBanner: string;
  squadTour: boolean;
  showGenericReferral: boolean;
  showStreakMilestone: boolean;
  showRecoverStreak: boolean;
  lastBootPopup: string;
  lastFeedSettingsFeedback: string;
  showTopReader: boolean;
  showSuperAgentTrialUpgrade: boolean;
  briefBannerLastSeen: string;
  opportunityId: string;
}

interface UserAlertsResponse {
  userAlerts: UserAlerts;
}

export default async function (
  fastify: FastifyInstance,
  con: DataSource,
): Promise<void> {
  fastify.get('/', async (req, res) => {
    const query = `{
      userAlerts {
        filter
        rankLastSeen
        myFeed
        companionHelper
        lastChangelog
        lastBanner
        squadTour
        showGenericReferral
        showStreakMilestone
        showRecoverStreak
        lastBootPopup
        lastFeedSettingsFeedback
        showTopReader
        showSuperAgentTrialUpgrade
        briefBannerLastSeen
        opportunityId
      }
    }`;

    return executeGraphql<UserAlerts>(
      con,
      { query },
      (obj) => (obj as unknown as UserAlertsResponse).userAlerts,
      req,
      res,
    );
  });
}

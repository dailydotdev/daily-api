import {
  UserIntegration,
  UserIntegrationSlack,
  UserIntegrationType,
} from '../entity/UserIntegration';
import { decrypt } from './crypto';

export const getIntegrationToken = async <
  TIntegration extends UserIntegration,
>({
  integration,
}: {
  integration: TIntegration;
}): Promise<string> => {
  switch (integration.type) {
    case UserIntegrationType.Slack: {
      const slackIntegration = integration as UserIntegrationSlack;

      return decrypt(
        slackIntegration.meta.accessToken,
        process.env.SLACK_DB_KEY,
      );
    }
    default:
      throw new Error('unsupported integration type');
  }
};

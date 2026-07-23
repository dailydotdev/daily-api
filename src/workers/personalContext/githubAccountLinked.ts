import { TypedWorker } from '../worker';
import { PersonalContextSource } from '../../entity/user/UserPersonalContext';
import { requestPersonalContext } from '../../common/personalContext/requestPersonalContext';
import { gitHubClient } from '../../integrations/github/clients';
import { remoteConfig } from '../../remoteConfig';

export const githubAccountLinkedWorker: TypedWorker<'api.v1.github-account-linked'> =
  {
    subscription: 'api.github-account-linked-personal-context',
    handler: async (message, con) => {
      const {
        data: { userId },
      } = message;

      if (!remoteConfig.vars.personalContextEnabled) {
        return;
      }

      const [account] = await con.query(
        `SELECT "accessToken" FROM ba_account WHERE "userId" = $1 AND "providerId" = 'github' LIMIT 1`,
        [userId],
      );

      if (!account?.accessToken) {
        return;
      }

      const { login } = await gitHubClient.getAuthenticatedUser(
        account.accessToken,
      );

      await requestPersonalContext({
        con,
        userId,
        source: PersonalContextSource.Github,
        value: login,
        verified: true,
      });
    },
  };

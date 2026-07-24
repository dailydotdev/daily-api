import { TypedWorker } from '../worker';
import { isChanged } from '../cdc/common';
import { PersonalContextSource } from '../../entity/user/UserPersonalContext';
import { requestPersonalContext } from '../../common/personalContext/requestPersonalContext';
import { remoteConfig } from '../../remoteConfig';

export const userUpdatedPersonalContextWorker: TypedWorker<'user-updated'> = {
  subscription: 'api.user-updated-personal-context',
  handler: async (message, con) => {
    const {
      data: { newProfile, user: oldUser },
    } = message;

    if (!remoteConfig.vars.personalContextEnabled) {
      return;
    }

    if (!isChanged(oldUser, newProfile, 'portfolio')) {
      return;
    }

    await requestPersonalContext({
      con,
      userId: newProfile.id,
      source: PersonalContextSource.Website,
      value: newProfile.portfolio,
      verified: true,
    });
  },
};

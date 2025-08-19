import { ghostUser, resubscribeUser } from '../common';
import { TypedWorker } from './worker';
import { cio, identifyUser } from '../cio';
import { isSubscribedToEmails } from './notifications/utils';

import { isSubscribedToNotificationType } from './notifications/utils';
import { NotificationChannel, NotificationType } from '../notifications/common';
import type { UserNotificationFlags } from '../entity/user';

const shouldResubscribeUser = (
  oldFlags: UserNotificationFlags,
  newFlags: UserNotificationFlags,
) => {
  const oldUserReceivedEmail = isSubscribedToEmails(oldFlags);
  const newUserReceivesEmail = isSubscribedToEmails(newFlags);

  const oldUserReceivedMarketing = isSubscribedToNotificationType(
    oldFlags,
    NotificationType.Marketing,
    NotificationChannel.Email,
  );
  const newUserReceivesMarketing = isSubscribedToNotificationType(
    newFlags,
    NotificationType.Marketing,
    NotificationChannel.Email,
  );

  return (
    (newUserReceivesEmail && !oldUserReceivedEmail) ||
    (newUserReceivesMarketing && !oldUserReceivedMarketing)
  );
};

const worker: TypedWorker<'user-updated'> = {
  subscription: 'api.user-updated-cio',
  handler: async (message, con, log) => {
    try {
      if (!process.env.CIO_SITE_ID) {
        return;
      }

      const {
        data: { newProfile: user, user: oldUser },
      } = message;

      if (
        user.id === ghostUser.id ||
        !user.infoConfirmed ||
        !user.emailConfirmed
      ) {
        return;
      }

      const oldFlags =
        typeof oldUser.notificationFlags === 'string'
          ? JSON.parse(oldUser.notificationFlags)
          : oldUser.notificationFlags;
      const newFlags =
        typeof user.notificationFlags === 'string'
          ? JSON.parse(user.notificationFlags)
          : user.notificationFlags;

      if (shouldResubscribeUser(oldFlags, newFlags)) {
        await resubscribeUser(cio, user.id);
      }

      await identifyUser({
        con,
        cio,
        user,
      });
      log.info({ userId: user.id }, 'updated user profile in customerio');
    } catch (_err) {
      const err = _err as Error;
      log.error({ err }, 'failed to update user profile in customerio');
      throw err;
    }
  },
};

export default worker;

import { TypedWorker } from './worker';
import { CandidateRejectedOpportunityMessage } from '@dailydotdev/schema';
import { User } from '../entity';
import { sendEmail, baseNotificationEmailData, formatMailDate, ONE_MINUTE_IN_SECONDS } from '../common';
import { isSubscribedToNotificationType } from './notifications/utils';
import { NotificationChannel, NotificationType } from '../notifications/common';

const REJECTION_EMAIL_DELAY_MS = 30 * ONE_MINUTE_IN_SECONDS * 1000;

const worker: TypedWorker<'api.v1.recruiter-rejected-candidate-match'> = {
  subscription: 'api.recruiter-rejected-candidate-match-email',
  handler: async ({ data }, con, logger): Promise<void> => {
    const { userId, opportunityId } = data;

    try {
      const user = await con.getRepository(User).findOne({
        where: { id: userId },
        select: ['id', 'email', 'notificationFlags'],
      });

      if (!user) {
        logger.warn(
          { userId, opportunityId },
          'User not found for recruiter rejected candidate email',
        );
        return;
      }

      if (!user.email) {
        logger.warn(
          { userId, opportunityId },
          'User has no email for recruiter rejected candidate email',
        );
        return;
      }

      const shouldReceiveEmail = isSubscribedToNotificationType(
        user.notificationFlags,
        NotificationType.NewOpportunityMatch,
        NotificationChannel.Email,
      );

      if (!shouldReceiveEmail) {
        logger.info(
          { userId, opportunityId },
          'User is not subscribed to recruiter rejected opportunity emails',
        );
        return;
      }

      const sendDate = new Date(Date.now() + REJECTION_EMAIL_DELAY_MS);
      await sendEmail({
        ...baseNotificationEmailData,
        reply_to: 'ido@daily.dev',
        transactional_message_id: '88',
        send_at: Math.floor(sendDate.getTime() / 1000),
        message_data: {
          opportunity_id: opportunityId,
          send_date: formatMailDate(sendDate),
        },
        identifiers: {
          id: user.id,
        },
        to: user.email,
      });
    } catch (_err) {
      const err = _err as Error;
      logger.error(
        { err, userId, opportunityId },
        'failed to send recruiter rejected candidate email',
      );
      throw err;
    }
  },
  parseMessage: (message) =>
    CandidateRejectedOpportunityMessage.fromBinary(message.data),
};

export default worker;

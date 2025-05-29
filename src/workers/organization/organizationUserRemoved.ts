import type { TypedWorker } from '../worker';
import { CioTransactionalMessageTemplateId, sendEmail } from '../../common';
import { Organization, User } from '../../entity';

export const organizationUserRemoved: TypedWorker<'api.v1.organization-user-removed'> =
  {
    subscription: 'api.organization-user-removed',
    handler: async ({ data }, con, logger) => {
      const { organizationId, memberId } = data;

      const [organization, user] = await Promise.all([
        con.getRepository(Organization).findOneBy({
          id: organizationId,
        }),
        con.getRepository(User).findOneBy({
          id: memberId,
        }),
      ]);

      if (!organization) {
        logger.error({ organizationId }, 'Organization not found');
        return;
      }
      if (!user) {
        logger.error({ userId: memberId }, 'User not found');
        return;
      }

      await sendEmail({
        send_to_unsubscribed: false,
        transactional_message_id:
          CioTransactionalMessageTemplateId.OrganizationMemberRemoved,
        message_data: {
          organization: {
            name: organization.name,
          },
        },
        identifiers: {
          id: user.id,
        },
        to: user.email,
      });
    },
  };

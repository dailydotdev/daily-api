import { ContentPreferenceOrganization } from '../../entity/contentPreference/ContentPreferenceOrganization';
import type { TypedWorker } from '../worker';
import { CioTransactionalMessageTemplateId, sendEmail } from '../../common';

export const organizationUserRemoved: TypedWorker<'api.v1.organization-user-removed'> =
  {
    subscription: 'api.organization-user-removed',
    handler: async ({ data }, con) => {
      const { organizationId, memberId } = data;

      const member = await con
        .getRepository(ContentPreferenceOrganization)
        .findOneOrFail({
          where: { organizationId, userId: memberId },
          relations: {
            organization: true,
            user: true,
          },
        });

      const organization = await member.organization;
      const user = await member.user;

      await sendEmail({
        send_to_unsubscribed: true,
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

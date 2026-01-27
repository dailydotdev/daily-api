import { TypedWorker } from './worker';
import { Organization } from '../entity/Organization';
import { webhooks } from '../common';

const worker: TypedWorker<'api.v1.opportunity-in-review'> = {
  subscription: 'api.opportunity-in-review-slack',
  handler: async ({ data }, con, logger): Promise<void> => {
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    const { opportunityId, organizationId, title } = data;

    try {
      // Fetch organization name
      const organization = await con
        .getRepository(Organization)
        .findOne({ where: { id: organizationId } });

      if (!organization) {
        logger.warn(
          { opportunityId, organizationId },
          'Organization not found for opportunity in review',
        );
        return;
      }

      await webhooks.recruiter.send({
        text: 'New opportunity submitted for review!',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*New opportunity submitted for review*\n*Title:* <${process.env.COMMENTS_PREFIX}/jobs/${opportunityId}|${title}>\n*Organization:* ${organization.name}\n*ID:* \`${opportunityId}\``,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Accept', emoji: true },
                style: 'primary',
                action_id: 'opportunity_review_accept',
                value: JSON.stringify({ opportunityId }),
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Reject', emoji: true },
                style: 'danger',
                action_id: 'opportunity_review_reject',
                value: JSON.stringify({ opportunityId }),
              },
            ],
          },
        ],
      });
    } catch (err) {
      logger.error(
        { data, err },
        'failed to send opportunity in review slack message',
      );
    }
  },
};

export default worker;

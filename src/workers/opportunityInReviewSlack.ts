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
        attachments: [
          {
            title,
            title_link: `${process.env.COMMENTS_PREFIX}/jobs/${opportunityId}`,
            fields: [
              {
                title: 'Organization',
                value: organization.name,
              },
              {
                title: 'Opportunity ID',
                value: opportunityId,
              },
            ],
            color: '#FFB800', // Yellow/orange for review state
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

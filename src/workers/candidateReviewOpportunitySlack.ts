import { TypedWorker } from './worker';
import { webhooks } from '../common';

const worker: TypedWorker<'api.v1.candidate-review-opportunity'> = {
  subscription: 'api.candidate-review-opportunity-slack',
  handler: async ({ data }, _con, logger): Promise<void> => {
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    const {
      opportunityId,
      userId,
      opportunityTitle,
      organizationName,
      candidateUsername,
      candidateName,
      matchScore,
      screening,
      cvSummary,
      salaryExpectation,
      location,
      keywords,
    } = data;

    try {
      const buttonValue = JSON.stringify({ opportunityId, userId });

      await webhooks.recruiter.send({
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: 'Candidate Ready for Internal Review',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Opportunity:*\n<${process.env.COMMENTS_PREFIX}/jobs/${opportunityId}|${opportunityTitle}>`,
              },
              {
                type: 'mrkdwn',
                text: `*Organization:*\n${organizationName}`,
              },
            ],
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Candidate:*\n<${process.env.COMMENTS_PREFIX}/${candidateUsername}|${candidateName}>`,
              },
              {
                type: 'mrkdwn',
                text: `*Match Score:*\n${matchScore !== null ? `${Math.round(matchScore * 100)}%` : 'N/A'}`,
              },
            ],
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Salary Expectation:*\n${salaryExpectation?.min ? `$${salaryExpectation.min}+${salaryExpectation.period ? `/${salaryExpectation.period}` : ''}` : 'Not specified'}`,
              },
              {
                type: 'mrkdwn',
                text: `*Location:*\n${location || 'Not specified'}`,
              },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Skills:*\n${keywords.length > 0 ? keywords.join(', ') : 'None specified'}`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*CV Summary:*\n${cvSummary ? (cvSummary.length > 500 ? `${cvSummary.slice(0, 497)}...` : cvSummary) : 'Not provided'}`,
            },
          },
          ...(screening
            ? [
                {
                  type: 'section' as const,
                  text: {
                    type: 'mrkdwn' as const,
                    text: `*Screening Answers:*\n\`\`\`${(() => {
                      const s = JSON.stringify(screening, null, 2);
                      return s.length > 500 ? `${s.slice(0, 497)}...` : s;
                    })()}\`\`\``,
                  },
                },
              ]
            : []),
          {
            type: 'divider',
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Accept',
                  emoji: true,
                },
                style: 'primary',
                action_id: 'candidate_review_accept',
                value: buttonValue,
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Reject',
                  emoji: true,
                },
                style: 'danger',
                action_id: 'candidate_review_reject',
                value: buttonValue,
              },
            ],
          },
        ],
      });
    } catch (err) {
      logger.error(
        { data, err },
        'failed to send candidate review opportunity slack message',
      );
    }
  },
};

export default worker;

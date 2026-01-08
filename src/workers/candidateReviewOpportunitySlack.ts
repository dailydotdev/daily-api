import { TypedWorker } from './worker';
import { webhooks } from '../common';
import type { PubSubSchema } from '../common/typedPubsub';

type CandidateReviewData = PubSubSchema['api.v1.candidate-review-opportunity'];

const formatSalary = (
  salary: CandidateReviewData['salaryExpectation'],
): string => {
  if (!salary?.min) return 'Not specified';
  const minValue = parseInt(salary.min, 10);
  if (isNaN(minValue)) return 'Not specified';
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(minValue);
  return `${formatted}+${salary.period ? `/${salary.period}` : ''}`;
};

const truncateText = (text: string | null, maxLength: number): string => {
  if (!text) return 'Not provided';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

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
                text: `*Salary Expectation:*\n${formatSalary(salaryExpectation)}`,
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
              text: `*CV Summary:*\n${truncateText(cvSummary, 500)}`,
            },
          },
          ...(screening
            ? [
                {
                  type: 'section' as const,
                  text: {
                    type: 'mrkdwn' as const,
                    text: `*Screening Answers:*\n\`\`\`${truncateText(JSON.stringify(screening, null, 2), 500)}\`\`\``,
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

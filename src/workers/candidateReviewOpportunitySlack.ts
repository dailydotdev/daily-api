import { TypedWorker } from './worker';
import { webhooks } from '../common';
import { OpportunityMatch } from '../entity/OpportunityMatch';
import { OpportunityJob } from '../entity/opportunities/OpportunityJob';
import { UserCandidatePreference } from '../entity/user/UserCandidatePreference';
import { UserCandidateKeyword } from '../entity/user/UserCandidateKeyword';

const truncate = (text: string | null | undefined, max = 500) =>
  text ? (text.length > max ? `${text.slice(0, max - 3)}...` : text) : null;

const worker: TypedWorker<'api.v1.candidate-review-opportunity'> = {
  subscription: 'api.candidate-review-opportunity-slack',
  handler: async ({ data }, con): Promise<void> => {
    if (process.env.NODE_ENV === 'development') return;

    const { opportunityId, userId } = data;
    const match = await con.getRepository(OpportunityMatch).findOne({
      where: { opportunityId, userId },
      relations: ['opportunity', 'user'],
    });
    if (!match) return;

    const [opportunity, user, pref, keywords] = await Promise.all([
      match.opportunity,
      match.user,
      con
        .getRepository(UserCandidatePreference)
        .findOne({ where: { userId }, relations: ['location'] }),
      con
        .getRepository(UserCandidateKeyword)
        .find({ where: { userId }, select: ['keyword'] }),
    ]);

    const org =
      opportunity instanceof OpportunityJob
        ? (await opportunity.organization)?.name
        : null;
    const loc = await pref?.location;
    const location = [loc?.city, loc?.subdivision, loc?.country]
      .filter(Boolean)
      .join(', ');
    const salary = pref?.salaryExpectation;
    const score = match.applicationRank?.score;

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
              text: `*Opportunity:*\n<${process.env.COMMENTS_PREFIX}/jobs/${opportunityId}|${opportunity?.title || opportunityId}>`,
            },
            { type: 'mrkdwn', text: `*Organization:*\n${org || 'N/A'}` },
          ],
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Candidate:*\n<${process.env.COMMENTS_PREFIX}/${user?.username || userId}|${user?.name || user?.username || 'Unknown'}>`,
            },
            {
              type: 'mrkdwn',
              text: `*Match Score:*\n${score != null ? `${Math.round(score * 100)}%` : 'N/A'}`,
            },
          ],
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Salary:*\n${salary?.min ? `$${salary.min}+${salary.period ? `/${salary.period}` : ''}` : 'N/A'}`,
            },
            { type: 'mrkdwn', text: `*Location:*\n${location || 'N/A'}` },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Skills:*\n${keywords.map((k) => k.keyword).join(', ') || 'N/A'}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*CV Summary:*\n${truncate(pref?.cvParsedMarkdown) || 'N/A'}`,
          },
        },
        ...(match.screening?.length
          ? [
              {
                type: 'section' as const,
                text: {
                  type: 'mrkdwn' as const,
                  text: `*Screening:*\n\`\`\`${truncate(
                    JSON.stringify(
                      match.screening.map((s) => ({
                        q: s.screening,
                        a: s.answer,
                      })),
                      null,
                      2,
                    ),
                  )}\`\`\``,
                },
              },
            ]
          : []),
        { type: 'divider' },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Accept', emoji: true },
              style: 'primary',
              action_id: 'candidate_review_accept',
              value: JSON.stringify({ opportunityId, userId }),
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Reject', emoji: true },
              style: 'danger',
              action_id: 'candidate_review_reject',
              value: JSON.stringify({ opportunityId, userId }),
            },
          ],
        },
      ],
    });
  },
};

export default worker;

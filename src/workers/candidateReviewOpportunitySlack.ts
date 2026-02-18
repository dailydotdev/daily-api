import { ApplicationScored } from '@dailydotdev/schema';
import { TypedWorker } from './worker';
import { validateGondulOpportunityMessage } from '../common/schema/opportunities';
import { ONE_DAY_IN_MINUTES, webhooks } from '../common';
import { generateResumeSignedUrl } from '../common/googleCloud';
import { OpportunityMatch } from '../entity/OpportunityMatch';
import { OpportunityJob } from '../entity/opportunities/OpportunityJob';
import { UserCandidatePreference } from '../entity/user/UserCandidatePreference';
import { UserCandidateKeyword } from '../entity/user/UserCandidateKeyword';

const worker: TypedWorker<'gondul.v1.candidate-application-scored'> = {
  subscription: 'api.candidate-review-opportunity-slack',
  parseMessage: (message) => ApplicationScored.fromBinary(message.data),
  handler: async ({ data }, con): Promise<void> => {
    if (process.env.NODE_ENV === 'development') return;

    if (!validateGondulOpportunityMessage(data)) {
      throw new Error('candidateReviewOpportunitySlack: invalid message payload');
    }

    const {
      opportunityId,
      userId,
      score: applicationScore,
      description,
    } = data;
    const match = await con.getRepository(OpportunityMatch).findOne({
      where: { opportunityId, userId },
      relations: ['opportunity', 'user'],
    });
    if (!match) {
      throw new Error(
        `candidateReviewOpportunitySlack: match not found (opportunityId=${opportunityId}, userId=${userId})`,
      );
    }

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
    const cv = pref?.cv;
    const cvSignedUrl = cv?.blob
      ? await generateResumeSignedUrl(cv.blob, 2 * ONE_DAY_IN_MINUTES)
      : null;
    const matchScore = match.description?.matchScore;

    await webhooks.recruiterReview.send({
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
              text: `*Match Score:*\n${matchScore != null ? `${Math.round(matchScore * 100)}%` : 'N/A'}`,
            },
          ],
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Application Score:*\n${applicationScore != null ? `${applicationScore.toFixed(1)}` : 'N/A'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Salary:*\n${salary?.min ? `$${salary.min}+${salary.period ? `/${salary.period}` : ''}` : 'N/A'}`,
            },
          ],
        },
        {
          type: 'section',
          fields: [
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
            text: `*Self applied:*\n${match.applicationRank?.selfApplied ? 'Yes' : 'No'}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*CV:*\n${cvSignedUrl ? `<${cvSignedUrl}|Download CV>` : 'N/A'}`,
          },
        },
        ...(description
          ? [
              {
                type: 'section' as const,
                text: {
                  type: 'mrkdwn' as const,
                  text: `*Application Summary:*\n${description}`,
                },
              },
            ]
          : []),
        ...(match.screening?.length
          ? [
              {
                type: 'section' as const,
                text: {
                  type: 'mrkdwn' as const,
                  text: `*Screening:*\n\`\`\`${JSON.stringify(
                    match.screening.map((s) => ({
                      q: s.screening,
                      a: s.answer,
                    })),
                    null,
                    2,
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

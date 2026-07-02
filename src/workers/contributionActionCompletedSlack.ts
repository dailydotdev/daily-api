import type { Block, KnownBlock } from '@slack/web-api';
import { contributionSubmissionEvidenceSchema } from '../common/schema/contributions';
import { webhooks } from '../common/slack';
import { ContributionAction } from '../entity/contribution/ContributionAction';
import { User } from '../entity/user/User';
import { TypedWorker } from './worker';

const parseEvidence = (evidence: string) => {
  try {
    const parsed = contributionSubmissionEvidenceSchema.safeParse(
      JSON.parse(evidence),
    );
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
};

const worker: TypedWorker<'api.v1.contribution-action-completed'> = {
  subscription: 'api.contribution-action-completed-slack',
  handler: async ({ data }, con, logger): Promise<void> => {
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    const { submission } = data;

    try {
      const [user, action] = await Promise.all([
        con.getRepository(User).findOneBy({ id: submission.userId }),
        con
          .getRepository(ContributionAction)
          .findOneBy({ id: submission.actionId }),
      ]);

      if (!user || !action) {
        logger.warn(
          {
            submissionId: submission.id,
            userId: submission.userId,
            actionId: submission.actionId,
          },
          'user or action not found for contribution slack notification',
        );
        return;
      }

      const { url, screenshotUrl, note } = parseEvidence(submission.evidence);
      const displayName = user.name || user.username || user.id;
      const profileLink = `${process.env.COMMENTS_PREFIX}/${user.username ?? user.id}`;

      const blocks: (KnownBlock | Block)[] = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: ':tada: Contribution action completed',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*User:*\n<${profileLink}|${displayName}>`,
            },
            { type: 'mrkdwn', text: `*Action:*\n${action.title}` },
            { type: 'mrkdwn', text: `*Points:*\n${submission.awardedPoints}` },
          ],
        },
      ];

      const proof = [
        url && `*URL:* <${url}|link>`,
        note && `*Note:* ${note}`,
      ].filter(Boolean);
      if (proof.length) {
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: `*Proof*\n${proof.join('\n')}` },
        });
      }
      if (screenshotUrl) {
        blocks.push({
          type: 'image',
          image_url: screenshotUrl,
          alt_text: 'Contribution proof screenshot',
        });
      }

      await webhooks.contributions.send({
        text: `${displayName} completed "${action.title}"`,
        blocks,
      });
    } catch (err) {
      logger.error(
        { submissionId: submission.id, err },
        'failed to send contribution action completed slack message',
      );
    }
  },
};

export default worker;

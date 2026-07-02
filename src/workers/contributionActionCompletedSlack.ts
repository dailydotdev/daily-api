import type { Block, KnownBlock } from '@slack/web-api';
import { contributionSubmissionEvidenceSchema } from '../common/schema/contributions';
import { webhooks } from '../common/slack';
import { getUserPermalink } from '../common/users';
import { ContributionAction } from '../entity/contribution/ContributionAction';
import { User } from '../entity/user/User';
import { TypedWorker } from './worker';

const escapeSlack = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const worker: TypedWorker<'api.v1.contribution-action-completed'> = {
  subscription: 'api.contribution-action-completed-slack',
  handler: async ({ data }, con, logger): Promise<void> => {
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    const { submission } = data;

    try {
      const [user, action] = await Promise.all([
        con.getRepository(User).findOne({
          where: { id: submission.userId },
          select: ['id', 'name', 'username'],
        }),
        con.getRepository(ContributionAction).findOne({
          where: { id: submission.actionId },
          select: ['id', 'title'],
        }),
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

      const parsedEvidence = contributionSubmissionEvidenceSchema.safeParse(
        JSON.parse(submission.evidence),
      );
      const { url, screenshotUrl, note } = parsedEvidence.success
        ? parsedEvidence.data
        : {};
      const displayName = escapeSlack(user.name || user.username || user.id);
      const title = escapeSlack(action.title);

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
              text: `*User:*\n<${getUserPermalink(user)}|${displayName}>\n\`${user.id}\``,
            },
            { type: 'mrkdwn', text: `*Action:*\n${title}` },
            { type: 'mrkdwn', text: `*Points:*\n${submission.awardedPoints}` },
            { type: 'mrkdwn', text: `*Submission:*\n\`${submission.id}\`` },
          ],
        },
      ];

      const proof = [
        url && `*URL:* <${url}|link>`,
        note && `*Note:* ${escapeSlack(note)}`,
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
        text: `${displayName} completed "${title}"`,
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

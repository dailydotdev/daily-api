import { DataSource } from 'typeorm';
import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/contributionActionCompletedSlack';
import { typedWorkers } from '../../src/workers';
import createOrGetConnection from '../../src/db';
import { webhooks } from '../../src/common/slack';
import { ContributionAction } from '../../src/entity/contribution/ContributionAction';
import { ContributionSubmissionStatus } from '../../src/entity/contribution/ContributionSubmission';
import { User } from '../../src/entity/user/User';

const mockSend = jest
  .spyOn(webhooks.contributions, 'send')
  .mockResolvedValue(undefined);

let con: DataSource;

const actionId = '5c1b1b1e-0000-4000-8000-000000000001';

const baseSubmission = {
  id: 'ca50b1e0-0000-4000-8000-000000000001',
  userId: 'sc-user',
  actionId,
  paymentId: null,
  evidence: JSON.stringify({
    url: 'https://reddit.com/r/programming/x',
    screenshotUrl: 'https://img.example.com/proof.png',
    note: 'Shared the post',
  }),
  status: ContributionSubmissionStatus.Approved,
  awardedPoints: 25,
  flags: '{}',
  reviewedAt: null,
  reviewedBy: null,
  createdAt: 0,
  updatedAt: 0,
};

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();
  await saveFixtures(con, User, [
    { id: 'sc-user', username: 'scuser', name: 'SC User', reputation: 10 },
  ]);
  await saveFixtures(con, ContributionAction, [
    { id: actionId, title: 'Post on Reddit', points: 25 },
  ]);
});

afterEach(async () => {
  await con.getRepository(ContributionAction).delete(actionId);
  await con.getRepository(User).delete('sc-user');
});

describe('contributionActionCompletedSlack worker', () => {
  it('should be registered', () => {
    expect(
      typedWorkers.find((item) => item.subscription === worker.subscription),
    ).toBeDefined();
  });

  it('should send a notification with user, action and proof', async () => {
    await expectSuccessfulTypedBackground<'api.v1.contribution-action-completed'>(
      worker,
      { submission: baseSubmission },
    );

    expect(mockSend).toHaveBeenCalledWith({
      text: 'SC User completed "Post on Reddit"',
      blocks: [
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
              text: `*User:*\n<${process.env.COMMENTS_PREFIX}/scuser|SC User>\n\`sc-user\``,
            },
            { type: 'mrkdwn', text: '*Action:*\nPost on Reddit' },
            { type: 'mrkdwn', text: '*Points:*\n25' },
            {
              type: 'mrkdwn',
              text: `*Submission:*\n\`${baseSubmission.id}\``,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Proof*\n*URL:* <https://reddit.com/r/programming/x|link>\n*Note:* Shared the post',
          },
        },
        {
          type: 'image',
          image_url: 'https://img.example.com/proof.png',
          alt_text: 'Contribution proof screenshot',
        },
      ],
    });
  });

  it('should omit proof section and image when evidence is empty', async () => {
    await expectSuccessfulTypedBackground<'api.v1.contribution-action-completed'>(
      worker,
      { submission: { ...baseSubmission, evidence: '{}' } },
    );

    const { blocks } = mockSend.mock.calls[0][0] as {
      blocks: { type: string }[];
    };
    expect(blocks.map((block) => block.type)).toEqual(['header', 'section']);
  });

  it('should escape mrkdwn-breaking characters in user and evidence text', async () => {
    await con.getRepository(User).update('sc-user', { name: 'Tom <& Jerry>' });

    await expectSuccessfulTypedBackground<'api.v1.contribution-action-completed'>(
      worker,
      {
        submission: {
          ...baseSubmission,
          evidence: JSON.stringify({ note: 'a <b> & c' }),
        },
      },
    );

    const { blocks } = mockSend.mock.calls[0][0] as {
      blocks: { fields?: { text: string }[]; text?: { text: string } }[];
    };
    expect(blocks[1].fields?.[0].text).toBe(
      `*User:*\n<${process.env.COMMENTS_PREFIX}/scuser|Tom &lt;&amp; Jerry&gt;>\n\`sc-user\``,
    );
    expect(blocks[2].text?.text).toBe('*Proof*\n*Note:* a &lt;b&gt; &amp; c');
  });

  it('should not send when the user or action is missing', async () => {
    await expectSuccessfulTypedBackground<'api.v1.contribution-action-completed'>(
      worker,
      { submission: { ...baseSubmission, userId: 'ghost' } },
    );

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should not throw when the webhook send fails', async () => {
    mockSend.mockRejectedValueOnce(new Error('Slack error'));

    await expectSuccessfulTypedBackground<'api.v1.contribution-action-completed'>(
      worker,
      { submission: baseSubmission },
    );

    expect(mockSend).toHaveBeenCalled();
  });
});

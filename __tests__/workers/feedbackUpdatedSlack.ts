import { expectSuccessfulTypedBackground } from '../helpers';
import worker from '../../src/workers/feedbackUpdatedSlack';
import { Feedback, FeedbackStatus } from '../../src/entity/Feedback';
import { User } from '../../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { typedWorkers } from '../../src/workers';
import { slackClient } from '../../src/common/slack';

const postMessageMock = jest.spyOn(slackClient, 'postMessage');
const updateMessageMock = jest.spyOn(slackClient, 'updateMessage');

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('feedbackUpdatedSlack worker', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.SLACK_USER_FEEDBACK_CHANNEL_ID = 'C_FEEDBACK';
    postMessageMock.mockResolvedValue({
      channel: 'C_FEEDBACK',
      ts: '1730011111.000200',
    });
    updateMessageMock.mockResolvedValue({
      channel: 'C_FEEDBACK',
      ts: '1730011111.000200',
    });

    await con.getRepository(User).save({
      id: '1',
      name: 'Test User',
      username: 'testuser',
      image: 'https://daily.dev/test.jpg',
    });
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should send slack message for accepted feedback', async () => {
    const feedback = await con.getRepository(Feedback).save({
      userId: '1',
      category: 1,
      description: 'Test feedback description',
      pageUrl: 'https://example.com/page',
      status: FeedbackStatus.Accepted,
      classification: {
        sentiment: '1',
        urgency: '2',
        tags: ['ui', 'bug'],
        summary: 'Test summary',
      },
      linearIssueUrl: 'https://linear.app/issue/123',
      flags: {},
    });

    await expectSuccessfulTypedBackground<'api.v1.feedback-updated'>(worker, {
      feedbackId: feedback.id,
    });

    expect(postMessageMock).toHaveBeenCalledTimes(1);
    expect(updateMessageMock).not.toHaveBeenCalled();

    const updated = await con
      .getRepository(Feedback)
      .findOneBy({ id: feedback.id });
    expect(updated?.flags?.slackNotifiedAt).toBeDefined();
    expect(updated?.flags?.slackMessageTs).toEqual('1730011111.000200');
    expect(updated?.flags?.slackChannelId).toEqual('C_FEEDBACK');
  });

  it('should skip non-accepted feedback', async () => {
    const feedback = await con.getRepository(Feedback).save({
      userId: '1',
      category: 1,
      description: 'Pending feedback',
      status: FeedbackStatus.Pending,
      flags: {},
    });

    await expectSuccessfulTypedBackground<'api.v1.feedback-updated'>(worker, {
      feedbackId: feedback.id,
    });

    expect(postMessageMock).not.toHaveBeenCalled();
    expect(updateMessageMock).not.toHaveBeenCalled();
  });

  it('should skip when feedback not found', async () => {
    await expectSuccessfulTypedBackground<'api.v1.feedback-updated'>(worker, {
      feedbackId: '00000000-0000-0000-0000-000000000000',
    });

    expect(postMessageMock).not.toHaveBeenCalled();
    expect(updateMessageMock).not.toHaveBeenCalled();
  });

  it('should skip if slackNotifiedAt is already set (idempotency)', async () => {
    const feedback = await con.getRepository(Feedback).save({
      userId: '1',
      category: 1,
      description: 'Test feedback',
      status: FeedbackStatus.Accepted,
      classification: {
        sentiment: '1',
        urgency: '2',
        tags: ['ui'],
        summary: 'Summary',
      },
      linearIssueUrl: 'https://linear.app/issue/123',
      flags: { slackNotifiedAt: new Date().toISOString() },
    });

    await expectSuccessfulTypedBackground<'api.v1.feedback-updated'>(worker, {
      feedbackId: feedback.id,
    });

    expect(postMessageMock).not.toHaveBeenCalled();
    expect(updateMessageMock).not.toHaveBeenCalled();
  });

  it('should update slack message for completed feedback', async () => {
    const feedback = await con.getRepository(Feedback).save({
      userId: '1',
      category: 1,
      description: 'Completed feedback',
      status: FeedbackStatus.Completed,
      linearIssueUrl: 'https://linear.app/issue/123',
      flags: {
        slackNotifiedAt: new Date().toISOString(),
        slackMessageTs: '1730011111.000200',
        slackChannelId: 'C_FEEDBACK',
      },
    });

    await expectSuccessfulTypedBackground<'api.v1.feedback-updated'>(worker, {
      feedbackId: feedback.id,
    });

    expect(updateMessageMock).toHaveBeenCalledTimes(1);
    expect(postMessageMock).not.toHaveBeenCalled();

    const updated = await con
      .getRepository(Feedback)
      .findOneBy({ id: feedback.id });
    expect(updated?.flags?.slackClosedAt).toBeDefined();
  });

  it('should update slack message for cancelled feedback', async () => {
    const feedback = await con.getRepository(Feedback).save({
      userId: '1',
      category: 1,
      description: 'Cancelled feedback',
      status: FeedbackStatus.Cancelled,
      linearIssueUrl: 'https://linear.app/issue/123',
      flags: {
        slackNotifiedAt: new Date().toISOString(),
        slackMessageTs: '1730011111.000200',
        slackChannelId: 'C_FEEDBACK',
      },
    });

    await expectSuccessfulTypedBackground<'api.v1.feedback-updated'>(worker, {
      feedbackId: feedback.id,
    });

    expect(updateMessageMock).toHaveBeenCalledTimes(1);
    expect(postMessageMock).not.toHaveBeenCalled();
  });

  it('should skip close update when slackMessageTs is missing', async () => {
    const feedback = await con.getRepository(Feedback).save({
      userId: '1',
      category: 1,
      description: 'Completed feedback without slack metadata',
      status: FeedbackStatus.Completed,
      flags: {},
    });

    await expectSuccessfulTypedBackground<'api.v1.feedback-updated'>(worker, {
      feedbackId: feedback.id,
    });

    expect(updateMessageMock).not.toHaveBeenCalled();
    expect(postMessageMock).not.toHaveBeenCalled();
  });

  it('should skip close update when slackClosedAt is already set', async () => {
    const feedback = await con.getRepository(Feedback).save({
      userId: '1',
      category: 1,
      description: 'Already closed feedback',
      status: FeedbackStatus.Completed,
      flags: {
        slackMessageTs: '1730011111.000200',
        slackChannelId: 'C_FEEDBACK',
        slackClosedAt: new Date().toISOString(),
      },
    });

    await expectSuccessfulTypedBackground<'api.v1.feedback-updated'>(worker, {
      feedbackId: feedback.id,
    });

    expect(updateMessageMock).not.toHaveBeenCalled();
    expect(postMessageMock).not.toHaveBeenCalled();
  });

  it('should handle slack API errors gracefully', async () => {
    postMessageMock.mockRejectedValueOnce(new Error('slack failure'));

    const feedback = await con.getRepository(Feedback).save({
      userId: '1',
      category: 1,
      description: 'Test feedback description',
      status: FeedbackStatus.Accepted,
      flags: {},
    });

    await expectSuccessfulTypedBackground<'api.v1.feedback-updated'>(worker, {
      feedbackId: feedback.id,
    });

    const updated = await con
      .getRepository(Feedback)
      .findOneBy({ id: feedback.id });
    expect(updated?.flags?.slackNotifiedAt).toBeUndefined();
    expect(postMessageMock).toHaveBeenCalledTimes(1);
  });
});

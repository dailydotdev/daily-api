import { expectSuccessfulTypedBackground } from '../helpers';
import worker from '../../src/workers/feedbackUpdatedSlack';
import { Feedback, FeedbackStatus } from '../../src/entity/Feedback';
import { User } from '../../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { typedWorkers } from '../../src/workers';
import { webhooks } from '../../src/common/slack';

jest.spyOn(webhooks.userFeedback, 'send').mockResolvedValue(undefined);

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('feedbackUpdatedSlack worker', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

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

  it('should send slack message for completed feedback', async () => {
    const feedback = await con.getRepository(Feedback).save({
      userId: '1',
      category: 1,
      description: 'Test feedback description',
      pageUrl: 'https://example.com/page',
      status: FeedbackStatus.Completed,
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

    expect(webhooks.userFeedback.send).toHaveBeenCalledTimes(1);
  });

  it('should skip non-completed feedback', async () => {
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

    expect(webhooks.userFeedback.send).not.toHaveBeenCalled();
  });

  it('should skip when feedback not found', async () => {
    await expectSuccessfulTypedBackground<'api.v1.feedback-updated'>(worker, {
      feedbackId: '00000000-0000-0000-0000-000000000000',
    });

    expect(webhooks.userFeedback.send).not.toHaveBeenCalled();
  });
});

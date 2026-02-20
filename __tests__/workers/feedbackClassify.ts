import { expectSuccessfulTypedBackground } from '../helpers';
import worker from '../../src/workers/feedbackClassify';
import { Feedback, FeedbackStatus } from '../../src/entity/Feedback';
import { User } from '../../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { typedWorkers } from '../../src/workers';

const mockClassifyUserFeedback = jest.fn();
const mockCreateFeedbackIssue = jest.fn();

jest.mock('../../src/integrations/bragi', () => ({
  getBragiClient: () => ({
    garmr: {
      execute: (fn: () => Promise<unknown>) => fn(),
    },
    instance: {
      classifyUserFeedback: (...args: unknown[]) =>
        mockClassifyUserFeedback(...args),
    },
  }),
}));

jest.mock('../../src/integrations/linear', () => ({
  createFeedbackIssue: (...args: unknown[]) => mockCreateFeedbackIssue(...args),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('feedbackClassify worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();

    mockClassifyUserFeedback.mockResolvedValue({
      classification: {
        sentiment: 1,
        urgency: 3,
        tags: ['ui', 'ux'],
        summary: 'Test summary',
        hasPromptInjection: false,
        suggestedTeam: 1,
      },
    });

    mockCreateFeedbackIssue.mockResolvedValue({
      id: 'linear-issue-123',
      url: 'https://linear.app/issue/123',
    });

    await con.getRepository(User).save([
      {
        id: '1',
        name: 'Ido',
        username: 'ido',
        image: 'https://daily.dev/ido.jpg',
      },
    ]);
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should process feedback and update status to Accepted', async () => {
    const feedback = await con.getRepository(Feedback).save({
      userId: '1',
      category: 1,
      description: 'Test feedback description',
      pageUrl: 'https://example.com',
      userAgent: 'Mozilla/5.0',
      status: FeedbackStatus.Pending,
      flags: {},
    });

    await expectSuccessfulTypedBackground<'api.v1.feedback-created'>(worker, {
      feedbackId: feedback.id,
    });

    const updated = await con
      .getRepository(Feedback)
      .findOneBy({ id: feedback.id });
    expect(updated?.status).toBe(FeedbackStatus.Accepted);
    expect(updated?.classification).toEqual({
      sentiment: '1',
      urgency: '3',
      tags: ['ui', 'ux'],
      summary: 'Test summary',
      hasPromptInjection: false,
      suggestedTeam: '1',
    });
    expect(updated?.linearIssueId).toBe('linear-issue-123');
    expect(updated?.linearIssueUrl).toBe('https://linear.app/issue/123');
  });

  it('should skip processing if feedback is already spam', async () => {
    const feedback = await con.getRepository(Feedback).save({
      userId: '1',
      category: 2,
      description: 'Spam content',
      status: FeedbackStatus.Spam,
      flags: {},
    });

    await expectSuccessfulTypedBackground<'api.v1.feedback-created'>(worker, {
      feedbackId: feedback.id,
    });

    const updated = await con
      .getRepository(Feedback)
      .findOneBy({ id: feedback.id });
    expect(updated?.status).toBe(FeedbackStatus.Spam);
  });

  it('should skip processing if feedback is not pending', async () => {
    const feedback = await con.getRepository(Feedback).save({
      userId: '1',
      category: 3,
      description: 'Already processed',
      status: FeedbackStatus.Accepted,
      flags: {},
    });

    await expectSuccessfulTypedBackground<'api.v1.feedback-created'>(worker, {
      feedbackId: feedback.id,
    });

    const updated = await con
      .getRepository(Feedback)
      .findOneBy({ id: feedback.id });
    expect(updated?.status).toBe(FeedbackStatus.Accepted);
  });

  it('should throw error if Linear client is not configured', async () => {
    mockCreateFeedbackIssue.mockResolvedValue(null);

    const feedback = await con.getRepository(Feedback).save({
      userId: '1',
      category: 4,
      description: 'Test feedback',
      status: FeedbackStatus.Pending,
      flags: {},
    });

    await expect(
      expectSuccessfulTypedBackground<'api.v1.feedback-created'>(worker, {
        feedbackId: feedback.id,
      }),
    ).rejects.toThrow('Linear client not configured');
  });

  it('should skip processing if feedback not found', async () => {
    await expectSuccessfulTypedBackground<'api.v1.feedback-created'>(worker, {
      feedbackId: '00000000-0000-0000-0000-000000000000',
    });

    expect(mockClassifyUserFeedback).not.toHaveBeenCalled();
    expect(mockCreateFeedbackIssue).not.toHaveBeenCalled();
  });
});

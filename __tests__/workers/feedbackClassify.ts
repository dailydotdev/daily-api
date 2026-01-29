import { expectSuccessfulTypedBackground } from '../helpers';
import worker from '../../src/workers/feedbackClassify';
import { Feedback } from '../../src/entity/Feedback';
import { User } from '../../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { typedWorkers } from '../../src/workers';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('feedbackClassify worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await con.getRepository(User).save([
      {
        id: '1',
        name: 'Ido',
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

  it('should process feedback and update status to completed', async () => {
    const feedback = await con.getRepository(Feedback).save({
      userId: '1',
      category: 'BUG',
      description: 'Test feedback description',
      pageUrl: 'https://example.com',
      userAgent: 'Mozilla/5.0',
      status: 'pending',
      flags: {},
    });

    await expectSuccessfulTypedBackground(worker, {
      feedback: { id: feedback.id },
    });

    const updated = await con
      .getRepository(Feedback)
      .findOneBy({ id: feedback.id });
    expect(updated?.status).toBe('completed');
    expect(updated?.classification).toBeDefined();
  });

  it('should skip processing if feedback is already spam', async () => {
    const feedback = await con.getRepository(Feedback).save({
      userId: '1',
      category: 'OTHER',
      description: 'Spam content',
      status: 'spam',
      flags: {},
    });

    await expectSuccessfulTypedBackground(worker, {
      feedback: { id: feedback.id },
    });

    const updated = await con
      .getRepository(Feedback)
      .findOneBy({ id: feedback.id });
    expect(updated?.status).toBe('spam');
  });

  it('should skip processing if feedback is not pending', async () => {
    const feedback = await con.getRepository(Feedback).save({
      userId: '1',
      category: 'FEATURE_REQUEST',
      description: 'Already processed',
      status: 'completed',
      flags: {},
    });

    await expectSuccessfulTypedBackground(worker, {
      feedback: { id: feedback.id },
    });

    const updated = await con
      .getRepository(Feedback)
      .findOneBy({ id: feedback.id });
    expect(updated?.status).toBe('completed');
  });
});

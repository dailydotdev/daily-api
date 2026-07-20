import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { expectSuccessfulTypedBackground, saveFixtures } from '../../helpers';
import { userInterestRunWorker as worker } from '../../../src/workers/interest/userInterestRun';
import { typedWorkers } from '../../../src/workers';
import { User } from '../../../src/entity';
import {
  UserInterest,
  UserInterestStatus,
} from '../../../src/entity/UserInterest';
import { usersFixture } from '../../fixture/user';
import { triggerTypedEvent } from '../../../src/common/typedPubsub';
import { runInterestAgent } from '../../../src/common/interest/runInterestAgent';

jest.mock('../../../src/common/typedPubsub', () => ({
  ...(jest.requireActual('../../../src/common/typedPubsub') as Record<
    string,
    unknown
  >),
  triggerTypedEvent: jest.fn(),
}));

jest.mock('../../../src/common/interest/runInterestAgent', () => ({
  runInterestAgent: jest.fn(),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
  await con.getRepository(UserInterest).save({
    id: 'uir-1',
    userId: usersFixture[0].id,
    query: 'cool zig projects',
    status: UserInterestStatus.Active,
  });
});

describe('userInterestRun worker', () => {
  it('is registered in typedWorkers', () => {
    const registered = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );
    expect(registered).toBeTruthy();
  });

  it('runs the agent, records the summary, and notifies when content was written', async () => {
    (runInterestAgent as jest.Mock).mockResolvedValue({
      findingsAdded: 2,
      summaryPostId: 'post-1',
      notifyRequested: true,
      summary: 'Added 2 finding(s), wrote a summary post, notified the user.',
    });

    await expectSuccessfulTypedBackground<'api.v1.interest-run-requested'>(
      worker,
      { interestId: 'uir-1' },
    );

    const interest = await con
      .getRepository(UserInterest)
      .findOneByOrFail({ id: 'uir-1' });
    expect(interest.lastRunAt).toBeTruthy();
    expect(interest.lastRunSummary).toEqual(
      'Added 2 finding(s), wrote a summary post, notified the user.',
    );

    const notifyCall = (triggerTypedEvent as jest.Mock).mock.calls.find(
      (call) => call[1] === 'api.v1.interest-content-available',
    );
    expect(notifyCall?.[2]).toEqual({
      interestId: 'uir-1',
      postId: 'post-1',
      userId: usersFixture[0].id,
    });
  });

  it('does not notify when no summary post was written', async () => {
    (runInterestAgent as jest.Mock).mockResolvedValue({
      findingsAdded: 0,
      summaryPostId: null,
      notifyRequested: true,
      summary: 'Added 0 finding(s).',
    });

    await expectSuccessfulTypedBackground<'api.v1.interest-run-requested'>(
      worker,
      { interestId: 'uir-1' },
    );

    expect(triggerTypedEvent).not.toHaveBeenCalled();
  });

  it('skips a stopped interest', async () => {
    await con
      .getRepository(UserInterest)
      .update({ id: 'uir-1' }, { status: UserInterestStatus.Stopped });

    await expectSuccessfulTypedBackground<'api.v1.interest-run-requested'>(
      worker,
      { interestId: 'uir-1' },
    );

    expect(runInterestAgent).not.toHaveBeenCalled();
  });
});

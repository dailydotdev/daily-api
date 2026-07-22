import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { expectSuccessfulTypedBackground, saveFixtures } from '../../helpers';
import { userInterestRunWorker as worker } from '../../../src/workers/interest/userInterestRun';
import { typedWorkers } from '../../../src/workers';
import { ArticlePost, Source, User } from '../../../src/entity';
import {
  UserInterest,
  UserInterestStatus,
} from '../../../src/entity/UserInterest';
import {
  InterestFinding,
  InterestFindingStatus,
} from '../../../src/entity/InterestFinding';
import { usersFixture } from '../../fixture/user';
import { postsFixture } from '../../fixture/post';
import { sourcesFixture } from '../../fixture';
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
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await con.getRepository(UserInterest).save({
    id: 'uir-1',
    userId: usersFixture[0].id,
    query: 'cool zig projects',
    status: UserInterestStatus.Active,
    outputModes: { feed: true, post: true, digest: false, notification: true },
  });
  (runInterestAgent as jest.Mock).mockResolvedValue({
    findingsAdded: 0,
    summaryPostId: null,
    summary: 'Added 0 finding(s) this run.',
  });
});

const seedFinding = (postId: string, status: InterestFindingStatus) =>
  con.getRepository(InterestFinding).save({
    id: `finding-${postId}`,
    interestId: 'uir-1',
    postId,
    score: 0.8,
    status,
  });

describe('userInterestRun worker', () => {
  it('is registered in typedWorkers', () => {
    const registered = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );
    expect(registered).toBeTruthy();
  });

  it('runs the agent, records the summary, surfaces new findings, and emits one batch notification', async () => {
    (runInterestAgent as jest.Mock).mockResolvedValue({
      findingsAdded: 2,
      summaryPostId: 'post-1',
      summary: 'Added 2 finding(s) this run, wrote a summary post.',
    });
    await seedFinding('p1', InterestFindingStatus.New);
    await seedFinding('p2', InterestFindingStatus.New);

    await expectSuccessfulTypedBackground<'api.v1.interest-run-requested'>(
      worker,
      { interestId: 'uir-1' },
    );

    const interest = await con
      .getRepository(UserInterest)
      .findOneByOrFail({ id: 'uir-1' });
    expect(interest.lastRunAt).toBeTruthy();
    expect(interest.lastRunSummary).toEqual(
      'Added 2 finding(s) this run, wrote a summary post.',
    );

    const call = (triggerTypedEvent as jest.Mock).mock.calls.find(
      (c) => c[1] === 'api.v1.interest-content-available',
    );
    expect(call?.[2]).toEqual({
      interestId: 'uir-1',
      userId: usersFixture[0].id,
      count: 2,
      runAt: expect.any(Number),
    });

    const surfaced = await con
      .getRepository(InterestFinding)
      .countBy({ interestId: 'uir-1', status: InterestFindingStatus.Surfaced });
    expect(surfaced).toEqual(2);
  });

  it('does not notify when the run produced no findings and no summary post', async () => {
    await seedFinding('p1', InterestFindingStatus.Surfaced);

    await expectSuccessfulTypedBackground<'api.v1.interest-run-requested'>(
      worker,
      { interestId: 'uir-1' },
    );

    expect(triggerTypedEvent).not.toHaveBeenCalled();
  });

  it('notifies for a summary post even when there are no new findings', async () => {
    (runInterestAgent as jest.Mock).mockResolvedValue({
      findingsAdded: 0,
      summaryPostId: 'post-1',
      summary: 'Added 0 finding(s) this run, wrote a summary post.',
    });

    await expectSuccessfulTypedBackground<'api.v1.interest-run-requested'>(
      worker,
      { interestId: 'uir-1' },
    );

    const call = (triggerTypedEvent as jest.Mock).mock.calls.find(
      (c) => c[1] === 'api.v1.interest-content-available',
    );
    expect(call?.[2]).toEqual({
      interestId: 'uir-1',
      userId: usersFixture[0].id,
      count: 0,
      runAt: expect.any(Number),
    });
  });

  it('surfaces new findings but does not notify when notifications are disabled', async () => {
    await con.getRepository(UserInterest).update(
      { id: 'uir-1' },
      {
        outputModes: {
          feed: true,
          post: true,
          digest: false,
          notification: false,
        },
      },
    );
    await seedFinding('p1', InterestFindingStatus.New);

    await expectSuccessfulTypedBackground<'api.v1.interest-run-requested'>(
      worker,
      { interestId: 'uir-1' },
    );

    expect(triggerTypedEvent).not.toHaveBeenCalled();
    const finding = await con
      .getRepository(InterestFinding)
      .findOneByOrFail({ id: 'finding-p1' });
    expect(finding.status).toEqual(InterestFindingStatus.Surfaced);
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

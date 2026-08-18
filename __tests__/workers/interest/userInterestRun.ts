import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import {
  expectSuccessfulTypedBackground,
  invokeTypedBackground,
  saveFixtures,
} from '../../helpers';
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
import {
  InterestRun,
  InterestRunStatus,
  InterestRunTrigger,
} from '../../../src/entity/InterestRun';
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
      agentSummary: 'Zig 0.14 landed with a new incremental compiler.',
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
      'Zig 0.14 landed with a new incremental compiler.',
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

  it('keeps the previous recap instead of persisting the machine fallback, which renders as the notification headline', async () => {
    await con
      .getRepository(UserInterest)
      .update({ id: 'uir-1' }, { lastRunSummary: 'Zig 0.14 shipped.' });
    (runInterestAgent as jest.Mock).mockResolvedValue({
      findingsAdded: 0,
      summaryPostId: null,
      summary: 'Added 0 finding(s) this run.',
      agentSummary: null,
    });
    await seedFinding('p1', InterestFindingStatus.New);

    await expectSuccessfulTypedBackground<'api.v1.interest-run-requested'>(
      worker,
      { interestId: 'uir-1' },
    );

    const interest = await con
      .getRepository(UserInterest)
      .findOneByOrFail({ id: 'uir-1' });
    expect(interest.lastRunSummary).toEqual('Zig 0.14 shipped.');

    const call = (triggerTypedEvent as jest.Mock).mock.calls.find(
      (c) => c[1] === 'api.v1.interest-content-available',
    );
    expect(call?.[2]).toMatchObject({ interestId: 'uir-1', count: 1 });
  });

  it('notifies for a summary post even when there are no new findings', async () => {
    (runInterestAgent as jest.Mock).mockResolvedValue({
      findingsAdded: 0,
      summaryPostId: 'post-1',
      summary: 'Added 0 finding(s) this run, wrote a summary post.',
      agentSummary: 'A deep dive on comptime landed this week.',
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

  it('completes the provided run with blocks and mirrors the state onto the interest', async () => {
    (runInterestAgent as jest.Mock).mockResolvedValue({
      findingsAdded: 2,
      summaryPostId: 'post-1',
      agentSummary: 'Zig 0.14 landed with a new incremental compiler.',
      finalMessage: 'Delivered two strong Zig finds and a summary post.',
    });
    await con.getRepository(InterestFinding).save([
      {
        id: 'finding-p1',
        interestId: 'uir-1',
        postId: 'p1',
        score: 0.9,
        status: InterestFindingStatus.New,
      },
      {
        id: 'finding-p2',
        interestId: 'uir-1',
        postId: 'p2',
        score: 0.7,
        status: InterestFindingStatus.New,
      },
    ]);
    await con.getRepository(InterestRun).save({
      id: 'run-1',
      interestId: 'uir-1',
      status: InterestRunStatus.Queued,
      trigger: InterestRunTrigger.Command,
    });

    await expectSuccessfulTypedBackground<'api.v1.interest-run-requested'>(
      worker,
      { interestId: 'uir-1', runId: 'run-1' },
    );

    const run = await con
      .getRepository(InterestRun)
      .findOneByOrFail({ id: 'run-1' });
    expect(run).toMatchObject({
      status: InterestRunStatus.Completed,
      trigger: InterestRunTrigger.Command,
      findingsAdded: 2,
      summaryPostId: 'post-1',
    });
    expect(run.startedAt).toBeTruthy();
    expect(run.finishedAt).toBeTruthy();
    expect(run.blocks).toEqual([
      {
        type: 'text',
        html: expect.stringContaining(
          'Delivered two strong Zig finds and a summary post.',
        ),
      },
      { type: 'picks', postIds: ['p1', 'p2'] },
    ]);

    const interest = await con
      .getRepository(UserInterest)
      .findOneByOrFail({ id: 'uir-1' });
    expect(interest.lastRunStatus).toEqual(InterestRunStatus.Completed);
    expect(interest.lastRunFindings).toEqual(2);
  });

  it('creates a scheduled run row when the message carries no runId', async () => {
    await expectSuccessfulTypedBackground<'api.v1.interest-run-requested'>(
      worker,
      { interestId: 'uir-1' },
    );

    const run = await con
      .getRepository(InterestRun)
      .findOneByOrFail({ interestId: 'uir-1' });
    expect(run).toMatchObject({
      status: InterestRunStatus.Completed,
      trigger: InterestRunTrigger.Scheduled,
    });
  });

  it('adds a feed link block when more findings were delivered than picks shown', async () => {
    await Promise.all(
      ['p1', 'p2', 'p3', 'p4'].map((postId) =>
        seedFinding(postId, InterestFindingStatus.New),
      ),
    );

    await expectSuccessfulTypedBackground<'api.v1.interest-run-requested'>(
      worker,
      { interestId: 'uir-1' },
    );

    const run = await con
      .getRepository(InterestRun)
      .findOneByOrFail({ interestId: 'uir-1' });
    expect(run.blocks).toContainEqual({
      type: 'feedLink',
      label: 'Open all 4 findings',
      count: 4,
    });
  });

  it('marks the run failed and rethrows when the agent errors', async () => {
    (runInterestAgent as jest.Mock).mockRejectedValue(new Error('boom'));
    await con.getRepository(InterestRun).save({
      id: 'run-1',
      interestId: 'uir-1',
      status: InterestRunStatus.Queued,
      trigger: InterestRunTrigger.Spawn,
    });

    await expect(
      invokeTypedBackground<'api.v1.interest-run-requested'>(worker, {
        interestId: 'uir-1',
        runId: 'run-1',
      }),
    ).rejects.toThrow('boom');

    const run = await con
      .getRepository(InterestRun)
      .findOneByOrFail({ id: 'run-1' });
    expect(run.status).toEqual(InterestRunStatus.Failed);
    expect(run.finishedAt).toBeTruthy();

    const interest = await con
      .getRepository(UserInterest)
      .findOneByOrFail({ id: 'uir-1' });
    expect(interest.lastRunStatus).toEqual(InterestRunStatus.Failed);
  });

  it('fails the provided run when the interest is not active', async () => {
    await con
      .getRepository(UserInterest)
      .update({ id: 'uir-1' }, { status: UserInterestStatus.Paused });
    await con.getRepository(InterestRun).save({
      id: 'run-1',
      interestId: 'uir-1',
      status: InterestRunStatus.Queued,
      trigger: InterestRunTrigger.Command,
    });

    await expectSuccessfulTypedBackground<'api.v1.interest-run-requested'>(
      worker,
      { interestId: 'uir-1', runId: 'run-1' },
    );

    expect(runInterestAgent).not.toHaveBeenCalled();
    const run = await con
      .getRepository(InterestRun)
      .findOneByOrFail({ id: 'run-1' });
    expect(run.status).toEqual(InterestRunStatus.Failed);
  });
});

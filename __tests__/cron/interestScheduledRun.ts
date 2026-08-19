import { crons } from '../../src/cron/index';
import cron from '../../src/cron/interestScheduledRun';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { User } from '../../src/entity';
import {
  UserInterestCadence,
  UserInterest,
  UserInterestStatus,
} from '../../src/entity/UserInterest';
import {
  InterestRun,
  InterestRunStatus,
  InterestRunTrigger,
} from '../../src/entity/InterestRun';
import { usersFixture } from '../fixture/user';
import { triggerTypedEvent } from '../../src/common/typedPubsub';

jest.mock('../../src/common/typedPubsub', () => ({
  ...(jest.requireActual('../../src/common/typedPubsub') as Record<
    string,
    unknown
  >),
  triggerTypedEvent: jest.fn(),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
  await con.getRepository(UserInterest).save([
    {
      id: 'due-null',
      userId: '1',
      query: 'a',
      status: UserInterestStatus.Active,
      lastRunAt: null,
    },
    {
      id: 'not-due',
      userId: '1',
      query: 'b',
      status: UserInterestStatus.Active,
      lastRunAt: new Date(),
    },
    {
      id: 'due-hourly',
      userId: '1',
      query: 'd',
      status: UserInterestStatus.Active,
      cadence: UserInterestCadence.Hourly,
      lastRunAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      id: 'not-due-daily',
      userId: '1',
      query: 'e',
      status: UserInterestStatus.Active,
      cadence: UserInterestCadence.Daily,
      lastRunAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      id: 'stopped',
      userId: '1',
      query: 'c',
      status: UserInterestStatus.Stopped,
      lastRunAt: null,
    },
  ]);
});

describe('interestScheduledRun cron', () => {
  it('is registered', () => {
    expect(crons.find((item) => item.name === cron.name)).toBeTruthy();
  });

  it('fans out a run only for due active interests', async () => {
    await expectSuccessfulCron(cron);

    const fired = (triggerTypedEvent as jest.Mock).mock.calls
      .filter((c) => c[1] === 'api.v1.interest-run-requested')
      .map((c) => c[2].interestId);

    expect(fired).toContain('due-null');
    expect(fired).toContain('due-hourly');
    expect(fired).not.toContain('not-due');
    expect(fired).not.toContain('not-due-daily');
    expect(fired).not.toContain('stopped');
  });

  it('creates a queued scheduled run row per fired interest and passes its id', async () => {
    await expectSuccessfulCron(cron);

    const runs = await con.getRepository(InterestRun).find();
    expect(runs.map(({ interestId }) => interestId).sort()).toEqual([
      'due-hourly',
      'due-null',
    ]);
    expect(runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: InterestRunStatus.Queued,
          trigger: InterestRunTrigger.Scheduled,
        }),
      ]),
    );

    const firedRunIds = (triggerTypedEvent as jest.Mock).mock.calls
      .filter((c) => c[1] === 'api.v1.interest-run-requested')
      .map((c) => c[2].runId)
      .sort();
    expect(firedRunIds).toEqual(runs.map(({ id }) => id).sort());
  });

  it('keeps a single queued scheduled run per interest across a backlog and re-emits its id', async () => {
    await expectSuccessfulCron(cron);
    await expectSuccessfulCron(cron);

    const runs = await con
      .getRepository(InterestRun)
      .findBy({ interestId: 'due-null' });
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toEqual(InterestRunStatus.Queued);

    const firedRunIds = (triggerTypedEvent as jest.Mock).mock.calls
      .filter(
        (c) =>
          c[1] === 'api.v1.interest-run-requested' &&
          c[2].interestId === 'due-null',
      )
      .map((c) => c[2].runId);
    expect(firedRunIds).toEqual([runs[0].id, runs[0].id]);
  });

  it('schedules a fresh run once the previous scheduled run left the queue', async () => {
    await expectSuccessfulCron(cron);
    const [first] = await con
      .getRepository(InterestRun)
      .findBy({ interestId: 'due-null' });
    await con
      .getRepository(InterestRun)
      .update({ id: first.id }, { status: InterestRunStatus.Completed });

    await expectSuccessfulCron(cron);

    const runs = await con
      .getRepository(InterestRun)
      .findBy({ interestId: 'due-null' });
    expect(runs).toHaveLength(2);
    expect(
      runs.filter(({ status }) => status === InterestRunStatus.Queued),
    ).toHaveLength(1);
  });
});

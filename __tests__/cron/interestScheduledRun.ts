import { crons } from '../../src/cron/index';
import cron from '../../src/cron/interestScheduledRun';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { User } from '../../src/entity';
import {
  UserInterest,
  UserInterestStatus,
} from '../../src/entity/UserInterest';
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
    expect(fired).not.toContain('not-due');
    expect(fired).not.toContain('stopped');
  });
});

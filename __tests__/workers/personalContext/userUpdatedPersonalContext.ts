import { DataSource } from 'typeorm';
import { userUpdatedPersonalContextWorker } from '../../../src/workers/personalContext/userUpdatedPersonalContext';
import { triggerTypedEvent } from '../../../src/common/typedPubsub';
import { ChangeObject } from '../../../src/types';
import { expectSuccessfulTypedBackground, saveFixtures } from '../../helpers';
import { User } from '../../../src/entity';
import {
  PersonalContextSource,
  PersonalContextStatus,
  UserPersonalContext,
} from '../../../src/entity/user/UserPersonalContext';
import { usersFixture } from '../../fixture/user';
import createOrGetConnection from '../../../src/db';

jest.mock('../../../src/common/typedPubsub', () => ({
  ...jest.requireActual('../../../src/common/typedPubsub'),
  triggerTypedEvent: jest.fn(),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();
  await saveFixtures(con, User, usersFixture);
});

const base = {
  id: '1',
  portfolio: 'https://old.dev',
} as ChangeObject<User>;

const invoke = (
  oldProfile: Partial<ChangeObject<User>>,
  newProfile: Partial<ChangeObject<User>>,
) =>
  expectSuccessfulTypedBackground(userUpdatedPersonalContextWorker, {
    user: { ...base, ...oldProfile } as ChangeObject<User>,
    newProfile: { ...base, ...newProfile } as ChangeObject<User>,
  });

describe('userUpdatedPersonalContext', () => {
  it('requests context and stores a pending website row when portfolio changes', async () => {
    await invoke(
      { portfolio: 'https://old.dev' },
      { portfolio: 'https://new.dev' },
    );

    const row = await con
      .getRepository(UserPersonalContext)
      .findOneBy({ userId: '1', source: PersonalContextSource.Website });

    expect(row).toMatchObject({
      userId: '1',
      source: PersonalContextSource.Website,
      sourceValue: 'https://new.dev',
      verified: true,
      status: PersonalContextStatus.Pending,
    });
    expect(row?.correlationId).toBeTruthy();
    expect(triggerTypedEvent).toHaveBeenCalledWith(
      expect.anything(),
      'api.v1.generate-personal-context',
      expect.objectContaining({
        userId: '1',
        sources: [
          { kind: PersonalContextSource.Website, value: 'https://new.dev' },
        ],
      }),
    );
  });

  it('does nothing when portfolio is unchanged', async () => {
    await invoke(
      { portfolio: 'https://same.dev', name: 'old' },
      { portfolio: 'https://same.dev', name: 'new' },
    );

    const count = await con.getRepository(UserPersonalContext).count();
    expect(count).toBe(0);
    expect(triggerTypedEvent).not.toHaveBeenCalled();
  });

  it('does nothing when the new portfolio is empty', async () => {
    await invoke({ portfolio: 'https://old.dev' }, { portfolio: '' });

    const count = await con.getRepository(UserPersonalContext).count();
    expect(count).toBe(0);
    expect(triggerTypedEvent).not.toHaveBeenCalled();
  });
});

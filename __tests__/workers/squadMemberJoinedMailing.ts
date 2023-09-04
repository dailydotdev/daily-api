import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import {
  getContactIdByEmail,
  addUserToContacts,
  LIST_DRIP_CAMPAIGN,
} from '../../src/common';
import worker from '../../src/workers/squadMemberJoinedMailing';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { SourceType, SquadSource, SourceMember, User } from '../../src/entity';
import { SourceMemberRoles } from '../../src/roles';
import { usersFixture } from '../fixture/user';
import { createSource } from '../fixture/source';

jest.mock('../../src/common', () => ({
  ...(jest.requireActual('../../src/common') as Record<string, unknown>),
  getContactIdByEmail: jest.fn(),
  addUserToContacts: jest.fn(),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

const usersFixtureWithMarketing = usersFixture.map((item) => ({
  ...item,
  acceptedMarketing: true,
}));

beforeEach(async () => {
  jest.resetAllMocks();

  await saveFixtures(con, User, usersFixtureWithMarketing);
  await con
    .getRepository(SquadSource)
    .save([
      createSource(
        'squadMemberJoinedMailing_squad1',
        'squadMemberJoinedMailing_squad1',
        'http://c.com',
        SourceType.Squad,
      ),
    ]);
  await con.getRepository(SourceMember).save([
    {
      sourceId: 'squadMemberJoinedMailing_squad1',
      userId: '2',
      referralToken: 'rt1',
      role: SourceMemberRoles.Admin,
    },
  ]);
});

describe('squadMemberJoinedMailing worker', () => {
  it('should add owner to drip campaign mailing list', async () => {
    const sourceMember = await con.getRepository(SourceMember).findOneBy({
      sourceId: 'squadMemberJoinedMailing_squad1',
      userId: '2',
    });
    const user = await con.getRepository(User).findOneBy({ id: '2' });

    await expectSuccessfulBackground(worker, {
      sourceMember,
    });
    expect(getContactIdByEmail).toBeCalledTimes(1);
    expect(getContactIdByEmail).toBeCalledWith('tsahi@daily.dev');
    expect(addUserToContacts).toBeCalledTimes(1);
    expect(addUserToContacts).toBeCalledWith(
      user,
      [LIST_DRIP_CAMPAIGN],
      undefined,
    );
  });

  it('should not add non owners to drip campaign mailing list', async () => {
    await con.getRepository(SourceMember).save({
      sourceId: 'squadMemberJoinedMailing_squad1',
      userId: '2',
      role: SourceMemberRoles.Member,
    });
    const sourceMember = await con.getRepository(SourceMember).findOneBy({
      sourceId: 'squadMemberJoinedMailing_squad1',
      userId: '2',
    });

    await expectSuccessfulBackground(worker, {
      sourceMember,
    });
    expect(getContactIdByEmail).toBeCalledTimes(0);
    expect(addUserToContacts).toBeCalledTimes(0);
  });
});

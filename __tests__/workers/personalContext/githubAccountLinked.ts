import nock from 'nock';
import { DataSource } from 'typeorm';
import { githubAccountLinkedWorker } from '../../../src/workers/personalContext/githubAccountLinked';
import { triggerTypedEvent } from '../../../src/common/typedPubsub';
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
  nock.cleanAll();
  await saveFixtures(con, User, usersFixture);
  await con.query(`DELETE FROM ba_account`);
});

const linkGithubAccount = () =>
  con.query(
    `INSERT INTO ba_account (id, "accountId", "providerId", "userId", "accessToken") VALUES ('acc-1', '123', 'github', '1', 'gh-token')`,
  );

describe('githubAccountLinked', () => {
  it('resolves the github login and requests context for a linked account', async () => {
    await linkGithubAccount();
    nock('https://api.github.com')
      .get('/user')
      .reply(200, { login: 'octocat' });

    await expectSuccessfulTypedBackground(githubAccountLinkedWorker, {
      userId: '1',
    });

    const row = await con
      .getRepository(UserPersonalContext)
      .findOneBy({ userId: '1', source: PersonalContextSource.Github });
    expect(row).toMatchObject({
      sourceValue: 'octocat',
      verified: true,
      status: PersonalContextStatus.Pending,
    });
    expect(triggerTypedEvent).toHaveBeenCalledWith(
      expect.anything(),
      'api.v1.generate-personal-context',
      expect.objectContaining({
        userId: '1',
        sources: [{ kind: PersonalContextSource.Github, value: 'octocat' }],
      }),
    );
  });

  it('does nothing when the user has no linked github account', async () => {
    await expectSuccessfulTypedBackground(githubAccountLinkedWorker, {
      userId: '1',
    });

    const count = await con.getRepository(UserPersonalContext).count();
    expect(count).toBe(0);
    expect(triggerTypedEvent).not.toHaveBeenCalled();
  });

  it('marks the source failed and does not publish on a github api error', async () => {
    await linkGithubAccount();
    nock('https://api.github.com').get('/user').times(2).reply(401);

    await expectSuccessfulTypedBackground(githubAccountLinkedWorker, {
      userId: '1',
    });

    const row = await con
      .getRepository(UserPersonalContext)
      .findOneBy({ userId: '1', source: PersonalContextSource.Github });
    expect(row).toMatchObject({
      sourceValue: '123',
      status: PersonalContextStatus.Error,
    });
    expect(row?.error).toBeTruthy();
    expect(triggerTypedEvent).not.toHaveBeenCalled();
  });
});

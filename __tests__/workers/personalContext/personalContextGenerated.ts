import { DataSource } from 'typeorm';
import { personalContextGeneratedWorker } from '../../../src/workers/personalContext/personalContextGenerated';
import { expectSuccessfulTypedBackground, saveFixtures } from '../../helpers';
import { User } from '../../../src/entity';
import {
  PersonalContextSource,
  PersonalContextStatus,
  UserPersonalContext,
} from '../../../src/entity/user/UserPersonalContext';
import { usersFixture } from '../../fixture/user';
import createOrGetConnection from '../../../src/db';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, User, usersFixture);
  await con.getRepository(UserPersonalContext).save({
    userId: '1',
    source: PersonalContextSource.Website,
    sourceValue: 'https://new.dev',
    verified: true,
    status: PersonalContextStatus.Pending,
    correlationId: 'corr-1',
    requestedAt: new Date(),
  });
});

const getRow = () =>
  con
    .getRepository(UserPersonalContext)
    .findOneBy({ userId: '1', source: PersonalContextSource.Website });

describe('personalContextGenerated', () => {
  it('stores the synthesized context on a matching correlationId', async () => {
    await expectSuccessfulTypedBackground(personalContextGeneratedWorker, {
      userId: '1',
      correlationId: 'corr-1',
      status: 'ok',
      profileText: 'A backend engineer who loves Go.',
      context: {
        profile_text: 'A backend engineer who loves Go.',
        ranking_signals: { boost_tags: ['go', 'rust'], mute_tags: ['php'] },
      },
    });

    const row = await getRow();
    expect(row).toMatchObject({
      status: PersonalContextStatus.Ok,
      profileText: 'A backend engineer who loves Go.',
      boostTags: ['go', 'rust'],
      muteTags: ['php'],
    });
    expect(row?.generatedAt).toBeTruthy();
    expect(row?.context).toMatchObject({
      ranking_signals: { boost_tags: ['go', 'rust'], mute_tags: ['php'] },
    });
  });

  it('ignores a stale response whose correlationId no longer matches', async () => {
    await expectSuccessfulTypedBackground(personalContextGeneratedWorker, {
      userId: '1',
      correlationId: 'stale',
      status: 'ok',
      profileText: 'should not be stored',
      context: { ranking_signals: { boost_tags: ['x'], mute_tags: [] } },
    });

    const row = await getRow();
    expect(row).toMatchObject({
      status: PersonalContextStatus.Pending,
      profileText: null,
    });
  });

  it('records an error status and preserves prior profile text', async () => {
    await con
      .getRepository(UserPersonalContext)
      .update(
        { userId: '1', source: PersonalContextSource.Website },
        { status: PersonalContextStatus.Ok, profileText: 'previous good text' },
      );

    await expectSuccessfulTypedBackground(personalContextGeneratedWorker, {
      userId: '1',
      correlationId: 'corr-1',
      status: 'error',
      error: 'could not read source',
    });

    const row = await getRow();
    expect(row).toMatchObject({
      status: PersonalContextStatus.Error,
      error: 'could not read source',
      profileText: 'previous good text',
    });
  });
});

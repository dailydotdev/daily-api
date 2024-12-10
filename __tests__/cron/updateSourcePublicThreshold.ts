import { sourcesFixture } from './../fixture/source';
import { crons } from '../../src/cron/index';
import { updateSourcePublicThreshold as cron } from '../../src/cron/updateSourcePublicThreshold';
import { saveFixtures } from '../helpers';
import { expectSuccessfulCron } from '../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  Feed,
  Source,
  SourceType,
  SQUAD_IMAGE_PLACEHOLDER,
  User,
} from '../../src/entity';
import { updateFlagsStatement } from '../../src/common';
import { usersFixture } from '../fixture';
import { ContentPreferenceSource } from '../../src/entity/contentPreference/ContentPreferenceSource';
import { SourceMemberRoles } from '../../src/roles';
import { ContentPreferenceStatus } from '../../src/entity/contentPreference/types';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, Source, sourcesFixture);
});

describe('updateSourcePublicThreshold', () => {
  it('should be registered', () => {
    const registeredWorker = crons.find((item) => item.name === cron.name);

    expect(registeredWorker).toBeDefined();
  });

  it('should not update public threshold if members count is less than 3', async () => {
    const repo = con.getRepository(Source);
    await repo.update(
      { id: 'a' },
      { flags: updateFlagsStatement({ totalMembers: 2 }) },
    );
    await expectSuccessfulCron(cron);
    const source = await repo.findOneBy({ id: 'a' });
    expect(source!.flags.publicThreshold).toBeFalsy();
  });

  it('should not update public threshold if posts count is less than 3', async () => {
    const repo = con.getRepository(Source);
    await repo.update(
      { id: 'a' },
      { flags: updateFlagsStatement({ totalPosts: 2 }) },
    );
    await expectSuccessfulCron(cron);
    const source = await repo.findOneBy({ id: 'a' });
    expect(source!.flags.publicThreshold).toBeFalsy();
  });

  it('should not update public threshold if type is not Squad', async () => {
    const repo = con.getRepository(Source);
    await repo.update(
      { id: 'a' },
      { flags: updateFlagsStatement({ totalMembers: 3, totalPosts: 3 }) },
    );
    await expectSuccessfulCron(cron);
    const source = await repo.findOneBy({ id: 'a' });
    expect(source!.flags.publicThreshold).toBeFalsy();
  });

  it('should not update public threshold if image is default', async () => {
    const repo = con.getRepository(Source);
    await repo.update(
      { id: 'a' },
      {
        type: SourceType.Squad,
        image: SQUAD_IMAGE_PLACEHOLDER,
        description: 'not null',
        flags: updateFlagsStatement({ totalMembers: 3, totalPosts: 3 }),
      },
    );
    await expectSuccessfulCron(cron);
    const source = await repo.findOneBy({ id: 'a' });
    expect(source!.flags.publicThreshold).toBeFalsy();
  });

  it('should not update public threshold if image is null', async () => {
    const repo = con.getRepository(Source);
    await repo.update(
      { id: 'a' },
      {
        type: SourceType.Squad,
        flags: updateFlagsStatement({ totalMembers: 3, totalPosts: 3 }),
      },
    );
    await expectSuccessfulCron(cron);
    const source = await repo.findOneBy({ id: 'a' });
    expect(source!.flags.publicThreshold).toBeFalsy();
  });

  it('should not update public threshold if description is null', async () => {
    const repo = con.getRepository(Source);
    await repo.update(
      { id: 'a' },
      {
        type: SourceType.Squad,
        image: 'not null',
        flags: updateFlagsStatement({ totalMembers: 3, totalPosts: 3 }),
      },
    );
    await expectSuccessfulCron(cron);
    const source = await repo.findOneBy({ id: 'a' });
    expect(source!.flags.publicThreshold).toBeFalsy();
  });

  it('should update public threshold if all checks passed', async () => {
    const repo = con.getRepository(Source);
    await repo.update(
      { id: 'a' },
      {
        type: SourceType.Squad,
        image: 'not null',
        description: 'not null',
        flags: updateFlagsStatement({ totalMembers: 3, totalPosts: 3 }),
      },
    );
    await expectSuccessfulCron(cron);
    const source = await repo.findOneBy({ id: 'a' });
    expect(source!.flags.publicThreshold).toBeTruthy();
  });

  it('should not update public threshold if squad is vordr', async () => {
    const repo = con.getRepository(Source);
    await repo.update(
      { id: 'a' },
      {
        type: SourceType.Squad,
        image: 'not null',
        description: 'not null',
        flags: updateFlagsStatement({
          totalMembers: 3,
          totalPosts: 3,
          vordr: true,
        }),
      },
    );
    await expectSuccessfulCron(cron);
    const source = await repo.findOneBy({ id: 'a' });
    expect(source!.flags.publicThreshold).toBeFalsy();
  });

  it('should update public threshold if admin has high reputation', async () => {
    const repo = con.getRepository(Source);
    await repo.update(
      { id: 'a' },
      {
        type: SourceType.Squad,
        image: 'not null',
        description: 'not null',
      },
    );
    const users = usersFixture.slice(0, 2);
    await saveFixtures(con, User, users);
    await con
      .getRepository(User)
      .update({ id: usersFixture[0].id }, { reputation: 1000 });
    await con
      .getRepository(Feed)
      .insert(users.map((user) => ({ id: user.id, userId: user.id })));
    await con.getRepository(ContentPreferenceSource).insert(
      users.map((user) => ({
        userId: user.id,
        feedId: user.id,
        referenceId: 'a',
        status: ContentPreferenceStatus.Follow,
        flags: { role: SourceMemberRoles.Admin },
      })),
    );
    await expectSuccessfulCron(cron);
    const source = await repo.findOneBy({ id: 'a' });
    expect(source!.flags.publicThreshold).toBeTruthy();
  });
});

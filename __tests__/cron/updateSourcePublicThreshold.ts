import { sourcesFixture } from './../fixture/source';
import { crons } from '../../src/cron/index';
import { updateSourcePublicThreshold as cron } from '../../src/cron/updateSourcePublicThreshold';
import { saveFixtures } from '../helpers';
import { expectSuccessfulCron } from '../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { Source } from '../../src/entity';
import { updateFlagsStatement } from '../../src/common';

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
    const source = await con.getRepository(Source).findOneBy({ id: 'a' });
    expect(source!.flags.publicThreshold).toBeFalsy();
  });

  it('should not update public threshold if posts count is less than 3', async () => {
    const repo = con.getRepository(Source);
    await repo.update(
      { id: 'a' },
      { flags: updateFlagsStatement({ totalPosts: 2 }) },
    );
    await expectSuccessfulCron(cron);
    const source = await con.getRepository(Source).findOneBy({ id: 'a' });
    expect(source!.flags.publicThreshold).toBeFalsy();
  });

  it('should update public threshold if all checks passed', async () => {
    const repo = con.getRepository(Source);
    await repo.update(
      { id: 'a' },
      { flags: updateFlagsStatement({ totalMembers: 3, totalPosts: 3 }) },
    );
    await expectSuccessfulCron(cron);
    const source = await con.getRepository(Source).findOneBy({ id: 'a' });
    expect(source!.flags.publicThreshold).toBeTruthy();
  });
});

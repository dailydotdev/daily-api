import { crons } from '../../src/cron/index';
import cron from '../../src/cron/refreshToolStackStats';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import { User } from '../../src/entity/user/User';
import { usersFixture } from '../fixture/user';
import { UserStack } from '../../src/entity/user/UserStack';
import { DatasetTool } from '../../src/entity/dataset/DatasetTool';
import { ToolStackStats } from '../../src/entity/ToolStackStats';
import { expectSuccessfulCron } from '../helpers';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('refreshToolStackStats cron', () => {
  it('should be registered', () => {
    const registered = crons.find((item) => item.name === cron.name);
    expect(registered).toBeDefined();
  });

  it('should refresh the materialized view', async () => {
    await saveFixtures(con, User, usersFixture);
    const tool = await con.getRepository(DatasetTool).save({
      title: 'CronTool',
      titleNormalized: 'crontool',
      faviconSource: 'none',
    });
    await con.getRepository(UserStack).save({
      userId: '1',
      toolId: tool.id,
      section: 'Primary',
      position: 0,
    });

    await expectSuccessfulCron(cron);

    const stats = await con
      .getRepository(ToolStackStats)
      .findOneBy({ toolId: tool.id });
    expect(Number(stats?.stackCount)).toEqual(1);
  });
});

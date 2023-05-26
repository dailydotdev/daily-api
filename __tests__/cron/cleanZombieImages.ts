import cron from '../../src/cron/cleanZombieImages';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { ContentImage } from '../../src/entity';
import { subDays } from 'date-fns';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, ContentImage, [
    {
      serviceId: '1',
      url: 'https://daily.dev/1.jpg',
      shouldDelete: false,
      createdAt: subDays(new Date(), 31),
    },
    {
      serviceId: '2',
      url: 'https://daily.dev/2.jpg',
      createdAt: subDays(new Date(), 60),
    },
    {
      serviceId: '3',
      url: 'https://daily.dev/3.jpg',
      createdAt: subDays(new Date(), 7),
    },
  ]);
});

it('should delete images older than 30 days', async () => {
  await expectSuccessfulCron(cron);
  const images = await con.getRepository(ContentImage).find();
  expect(images.length).toEqual(1);
  expect(images[0].serviceId).toEqual('3');
});

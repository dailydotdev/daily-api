import { ReputationEvent } from '../../src/entity';
import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/sourceRequestApprovedRep';
import { Source, SourceRequest, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { NotificationReason } from '../../src/common';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { ChangeObject } from '../../src/types';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

const id = '57247803-bdcb-48eb-a963-30278519ff0b';

beforeEach(async () => {
  jest.resetAllMocks();
  const repo = con.getRepository(SourceRequest);
  const sourceRequest = repo.create({
    id,
    userId: '1',
    sourceUrl: 'https://daily.dev',
    closed: false,
  });
  await saveFixtures(con, Source, sourcesFixture);
  await repo.save(sourceRequest);
  await con.getRepository(User).save([
    {
      id: '1',
      name: 'Ido',
      image: 'https://daily.dev/ido.jpg',
      reputation: 3,
    },
  ]);
});

it('should create a reputation event that increases reputation', async () => {
  await expectSuccessfulTypedBackground(worker, {
    reason: NotificationReason.Publish,
    sourceRequest: {
      id,
      userId: '1',
    } as unknown as ChangeObject<SourceRequest>,
  });
  const event = await con
    .getRepository(ReputationEvent)
    .findOne({ where: { targetId: id, grantById: '', grantToId: '1' } });
  expect(event.amount).toEqual(200);
});

it('should not create a reputation event that increases reputation when type is not publish', async () => {
  await expectSuccessfulTypedBackground(worker, {
    sourceRequest: {
      id,
      userId: '1',
    } as unknown as ChangeObject<SourceRequest>,
    reason: NotificationReason.Approve,
  });
  const event = await con.getRepository(ReputationEvent).find();
  expect(event.length).toEqual(0);
});

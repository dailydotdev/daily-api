import { ReputationEvent } from './../../src/entity/ReputationEvent';
import { Connection, getConnection } from 'typeorm';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/sourceRequestApprovedRep';
import { Source, SourceRequest, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';

let con: Connection;

beforeAll(async () => {
  con = await getConnection();
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
  await expectSuccessfulBackground(worker, {
    request: { id, userId: '1' },
  });
  const event = await con
    .getRepository(ReputationEvent)
    .findOne({ where: { targetId: id, grantById: '', grantToId: '1' } });
  expect(event.amount).toEqual(200);
});

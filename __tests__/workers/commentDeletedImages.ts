import { expectSuccessfulBackground } from '../helpers';
import worker from '../../src/workers/commentDeletedImages';
import {
  Comment,
  ContentImage,
  ContentImageUsedByType,
} from '../../src/entity';
import { DataSource, IsNull, Not } from 'typeorm';
import createOrGetConnection from '../../src/db';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

const comment: Partial<Comment> = {
  id: 'c1',
  postId: 'c1',
  userId: '1',
  parentId: null,
};

beforeEach(async () => {
  jest.resetAllMocks();
  await con.getRepository(ContentImage).save([
    {
      serviceId: '1',
      url: 'https://daily.dev/1.jpg',
      usedByType: ContentImageUsedByType.Comment,
      usedById: 'c1',
    },
    { serviceId: '2', url: 'https://daily.dev/2.jpg' },
    {
      serviceId: '3',
      url: 'https://daily.dev/3.jpg',
      usedByType: ContentImageUsedByType.Comment,
      usedById: 'c2',
    },
  ]);
});

it('should clear all used images when content is empty', async () => {
  await expectSuccessfulBackground(worker, { comment });
  const actual = await con.getRepository(ContentImage).find({
    where: { usedByType: Not(IsNull()) },
    order: { serviceId: 'ASC' },
  });
  expect(actual.length).toEqual(1);
  expect(actual[0].serviceId).toEqual('3');
});

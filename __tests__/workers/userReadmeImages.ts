import { expectSuccessfulBackground } from '../helpers';
import worker from '../../src/workers/userReadmeImages';
import { ContentImage, ContentImageUsedByType } from '../../src/entity';
import { DataSource, IsNull, Not } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { markdown } from '../../src/common/markdown';
import { usersFixture } from '../fixture/user';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await con.getRepository(ContentImage).save([
    {
      serviceId: '1',
      url: 'https://daily.dev/1.jpg',
      usedByType: ContentImageUsedByType.User,
      usedById: '1',
    },
    { serviceId: '2', url: 'https://daily.dev/2.jpg' },
    {
      serviceId: '3',
      url: 'https://daily.dev/3.jpg',
      usedByType: ContentImageUsedByType.User,
      usedById: '2',
    },
  ]);
});

it('should clear all used images when content is empty', async () => {
  await expectSuccessfulBackground(worker, {
    user: usersFixture[0],
  });
  const actual = await con.getRepository(ContentImage).find({
    where: { usedByType: Not(IsNull()) },
    order: { serviceId: 'ASC' },
  });
  expect(actual.length).toEqual(1);
  expect(actual[0].serviceId).toEqual('3');
});

it('should update used images', async () => {
  const content = `
  # Here's my test markdown
  ![alt2](https://daily.dev/2.jpg) image 2
  `;
  const html = markdown.render(content);
  await expectSuccessfulBackground(worker, {
    user: {
      ...usersFixture[0],
      readme: content,
      readmeHtml: html,
    },
  });
  const actual = await con.getRepository(ContentImage).find({
    where: { usedById: '1' },
    order: { serviceId: 'ASC' },
  });
  expect(actual.length).toEqual(1);
  expect(actual[0].serviceId).toEqual('2');
});

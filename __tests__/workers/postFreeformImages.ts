import { expectSuccessfulBackground } from '../helpers';
import worker from '../../src/workers/postFreeformImages';
import {
  PostType,
  ContentImage,
  ContentImageUsedByType,
} from '../../src/entity';
import { DataSource, IsNull, Not } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { postsFixture } from '../fixture/post';
import { markdown } from '../../src/common/markdown';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await con.getRepository(ContentImage).save([
    { serviceId: '1', url: 'https://daily.dev/1.jpg' },
    { serviceId: '2', url: 'https://daily.dev/2.jpg' },
    { serviceId: '3', url: 'https://daily.dev/3.jpg' },
  ]);
});

it('should do nothing for post without a content html', async () => {
  await expectSuccessfulBackground(worker, {
    post: postsFixture[0],
  });
  const actual = await con.getRepository(ContentImage).find({
    where: { usedByType: Not(IsNull()) },
    order: { serviceId: 'ASC' },
  });
  expect(actual.length).toEqual(0);
});

it('should set used images as not marked for deletion', async () => {
  const content = `
  # Here's my test markdown
  ![alt1](https://daily.dev/1.jpg) image 1
  ![alt2](https://daily.dev/2.jpg) image 2
  ![alt3](https://daily.dev/doesnotexist.jpg) does not exist
  `;
  const html = markdown.render(content);
  await expectSuccessfulBackground(worker, {
    post: {
      ...postsFixture[0],
      type: PostType.Freeform,
      content,
      contentHtml: html,
    },
  });
  const actual = await con.getRepository(ContentImage).find({
    where: { usedByType: Not(IsNull()) },
    order: { serviceId: 'ASC' },
  });
  expect(actual.length).toEqual(2);
  expect(actual[0].serviceId).toEqual('1');
  expect(actual[1].serviceId).toEqual('2');
  actual.forEach((image) => {
    expect(image.usedByType).toEqual(ContentImageUsedByType.Post);
    expect(image.usedById).toEqual('p1');
  });
});

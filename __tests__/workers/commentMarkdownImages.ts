import { expectSuccessfulBackground } from '../helpers';
import worker from '../../src/workers/commentMarkdownImages';
import {
  ContentImage,
  ContentImageUsedByType,
  Comment,
} from '../../src/entity';
import { DataSource, IsNull, Not } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { markdown } from '../../src/common/markdown';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

const comment: Partial<Comment> = {
  id: 'c1',
  postId: 'p1',
  userId: '1',
  parentId: null,
};

beforeEach(async () => {
  jest.resetAllMocks();
  await con.getRepository(ContentImage).save([
    { serviceId: '1', url: 'https://daily.dev/1.jpg' },
    { serviceId: '2', url: 'https://daily.dev/2.jpg' },
    { serviceId: '3', url: 'https://daily.dev/3.jpg' },
  ]);
});

it('should do nothing for post without a content html', async () => {
  await expectSuccessfulBackground(worker, { comment });
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
    comment: {
      ...comment,
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
    expect(image.usedByType).toEqual(ContentImageUsedByType.Comment);
    expect(image.usedById).toEqual('c1');
  });
});

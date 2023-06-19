import { expectSuccessfulBackground } from '../helpers';
import {
  commentEditedWorker,
  commentDeletedWorker,
} from '../../src/workers/commentEditedImages';
import {
  Comment,
  ContentImage,
  ContentImageUsedByType,
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

describe('worker commentEditedWorker', () => {
  it('should clear all used images when content is empty', async () => {
    await expectSuccessfulBackground(commentEditedWorker, { comment });
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
    await expectSuccessfulBackground(commentEditedWorker, {
      comment: {
        ...comment,
        content,
        contentHtml: html,
      },
    });
    const actual = await con.getRepository(ContentImage).find({
      where: { usedById: 'c1' },
      order: { serviceId: 'ASC' },
    });
    expect(actual.length).toEqual(1);
    expect(actual[0].serviceId).toEqual('2');
  });
});

describe('worker commentDeletedWorker', () => {
  it('should clear all used images when content is empty', async () => {
    await expectSuccessfulBackground(commentDeletedWorker, { comment });
    const actual = await con.getRepository(ContentImage).find({
      where: { usedByType: Not(IsNull()) },
      order: { serviceId: 'ASC' },
    });
    expect(actual.length).toEqual(1);
    expect(actual[0].serviceId).toEqual('3');
  });
});

import worker from '../../src/workers/commentMentionMail';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { ChangeObject } from '../../src/types';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import {
  baseNotificationEmailData,
  getDiscussionLink,
  pickImageUrl,
  sendEmail,
  truncatePost,
} from '../../src/common';
import { Comment, CommentMention, Post, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { usersFixture } from '../fixture/user';

jest.mock('../../src/common', () => ({
  ...(jest.requireActual('../../src/common') as Record<string, unknown>),
  // For some reason it's required to override truncatePost
  truncatePost: () => 'truncate',
  sendEmail: jest.fn(),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();
});

type ObjectType = CommentMention;
const base: ChangeObject<ObjectType> = {
  commentId: 'c1',
  mentionedUserId: '1',
  commentByUserId: '2',
};

const saveMentionCommentFixtures = async () => {
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await con.getRepository(Comment).save({
    id: 'c1',
    postId: 'p1',
    userId: '2',
    content: `parent comment @idoshamun`,
    contentHtml: `<p>parent comment <a>@idoshamun</a></p>`,
    createdAt: new Date(2020, 1, 6, 0, 0),
  });
  await con
    .getRepository(CommentMention)
    .save({ commentId: 'c1', commentByUserId: '2', mentionedUserId: '1' });
};

beforeEach(async () => {
  await saveMentionCommentFixtures();
});

it('should send email for the mentioned user', async () => {
  await expectSuccessfulBackground(worker, { commentMention: base });
  const comment = await con
    .getRepository(Comment)
    .findOneBy({ id: base.commentId });
  const post = await comment.post;
  const commenter = await comment.user;
  const mentioned = await con
    .getRepository(User)
    .findOneBy({ id: base.mentionedUserId });
  const [first_name] = mentioned.name.split(' ');
  const params = {
    ...baseNotificationEmailData,
    to: mentioned.email,
    templateId: 'd-6949e2e50def4c6698900032973d469b',
    dynamicTemplateData: {
      first_name,
      full_name: commenter.name,
      comment: comment.content,
      user_handle: mentioned.username,
      commenter_profile_image: commenter.image,
      post_title: truncatePost(post),
      post_image: post.image || pickImageUrl(post),
      post_link: getDiscussionLink(post.id),
    },
  };
  expect(sendEmail).toBeCalledTimes(1);
  expect(sendEmail).toBeCalledWith(params);
});

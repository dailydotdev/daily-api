import { DataSource } from 'typeorm';
import { postsFixture } from '../fixture/post';
import createOrGetConnection from '../../src/db';
import { sourcesFixture } from '../fixture/source';
import {
  Alerts,
  ArticlePost,
  Comment,
  Post,
  PostType,
  Source,
  SourceMember,
  User,
  UserAction,
  UserActionType,
} from '../../src/entity';
import { saveFixtures } from '../helpers';
import { usersFixture } from '../fixture/user';
import { retroCheckActions } from '../../bin/completedUserActions';
import { SourceMemberRoles } from '../../src/roles';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await con.getRepository(Comment).save([
    {
      id: 'c1',
      postId: 'p1',
      userId: '1',
      content: 'comment',
      contentHtml: '<p>comment</p>',
    },
  ]);
});

const getAction = (type: UserActionType) =>
  con.getRepository(UserAction).findOneBy({ type });

describe('retro checks for user completed actions', () => {
  it('should insert my_feed action type for users who filtered the feed', async () => {
    await con.getRepository(Alerts).save({ filter: false, userId: '1' });
    const action = await getAction(UserActionType.MyFeed);
    expect(action).toBeFalsy();

    await retroCheckActions(con);

    const completed = await getAction(UserActionType.MyFeed);
    expect(completed).toBeTruthy();
  });

  it('should not insert my_feed action type for users who have not filtered the feed', async () => {
    await con.getRepository(Alerts).save({ filter: true, userId: '1' });
    const action = await getAction(UserActionType.MyFeed);
    expect(action).toBeFalsy();

    await retroCheckActions(con);

    const completed = await getAction(UserActionType.MyFeed);
    expect(completed).toBeFalsy();
  });

  const preparePost = async (type = PostType.Share) => {
    const repo = con.getRepository(Post);
    await repo.update({ id: 'p1' }, { type, authorId: '1' });
  };

  it('should insert squad first post action type for users who have a shared post', async () => {
    await preparePost();
    const action = await getAction(UserActionType.SquadFirstPost);
    expect(action).toBeFalsy();

    await retroCheckActions(con);

    const completed = await getAction(UserActionType.SquadFirstPost);
    expect(completed).toBeTruthy();
  });

  it('should not insert squad first post action type for users who do not have a post', async () => {
    await preparePost(PostType.Article);
    const action = await getAction(UserActionType.SquadFirstPost);
    expect(action).toBeFalsy();

    await retroCheckActions(con);

    const completed = await getAction(UserActionType.SquadFirstPost);
    expect(completed).toBeFalsy();
  });

  it('should insert squad first post comment action type for users who commented in a share post', async () => {
    await preparePost();
    const action = await getAction(UserActionType.SquadFirstComment);
    expect(action).toBeFalsy();

    await retroCheckActions(con);

    const completed = await getAction(UserActionType.SquadFirstComment);
    expect(completed).toBeTruthy();
  });

  it('should not insert squad first post comment action type for users who commented not in a share post', async () => {
    await preparePost(PostType.Article);
    const action = await getAction(UserActionType.SquadFirstComment);
    expect(action).toBeFalsy();

    await retroCheckActions(con);

    const completed = await getAction(UserActionType.SquadFirstComment);
    expect(completed).toBeFalsy();
  });

  it('should insert squad_invite action type for users who were able to invite other users', async () => {
    await con.getRepository(User).update({ id: '2' }, { referralId: '1' });
    const action = await getAction(UserActionType.SquadInvite);
    expect(action).toBeFalsy();

    await retroCheckActions(con);

    const completed = await getAction(UserActionType.SquadInvite);
    expect(completed).toBeTruthy();
  });

  it('should not insert squad_invite action type for users who were not able to invite other users', async () => {
    await con.getRepository(User).update({ id: '2' }, { referralId: null });
    const action = await getAction(UserActionType.SquadInvite);
    expect(action).toBeFalsy();

    await retroCheckActions(con);

    const completed = await getAction(UserActionType.SquadInvite);
    expect(completed).toBeFalsy();
  });

  const prepareSourceMember = async (role: SourceMemberRoles) => {
    await preparePost();
    await con.getRepository(SourceMember).save({
      userId: '1',
      role,
      referralToken: 'token',
      sourceId: 'a',
      createdAt: new Date(),
    });
  };

  it('should insert create_squad action type for squad admins', async () => {
    await prepareSourceMember(SourceMemberRoles.Admin);
    const action = await getAction(UserActionType.CreateSquad);
    expect(action).toBeFalsy();

    await retroCheckActions(con);

    const completed = await getAction(UserActionType.CreateSquad);
    expect(completed).toBeTruthy();
  });

  it('should not insert create_squad action type for squad non-admins', async () => {
    await prepareSourceMember(SourceMemberRoles.Member);
    const action = await getAction(UserActionType.CreateSquad);
    expect(action).toBeFalsy();

    await retroCheckActions(con);

    const completed = await getAction(UserActionType.CreateSquad);
    expect(completed).toBeFalsy();
  });

  it('should insert join_squad action type for squad non-admins', async () => {
    await prepareSourceMember(SourceMemberRoles.Member);
    const action = await getAction(UserActionType.JoinSquad);
    expect(action).toBeFalsy();

    await retroCheckActions(con);

    const completed = await getAction(UserActionType.JoinSquad);
    expect(completed).toBeTruthy();
  });

  it('should insert join_squad action type for squad non-admins', async () => {
    await prepareSourceMember(SourceMemberRoles.Moderator);
    const action = await getAction(UserActionType.JoinSquad);
    expect(action).toBeFalsy();

    await retroCheckActions(con);

    const completed = await getAction(UserActionType.JoinSquad);
    expect(completed).toBeTruthy();
  });

  it('should not insert join_squad action type for squad admins', async () => {
    await prepareSourceMember(SourceMemberRoles.Admin);
    const action = await getAction(UserActionType.JoinSquad);
    expect(action).toBeFalsy();

    await retroCheckActions(con);

    const completed = await getAction(UserActionType.JoinSquad);
    expect(completed).toBeFalsy();
  });
});

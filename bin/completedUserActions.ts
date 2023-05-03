import '../src/config';
import {
  Alerts,
  Comment,
  Post,
  PostType,
  SourceMember,
  UserActionType,
  User,
} from '../src/entity';
import createOrGetConnection from '../src/db';
import { SourceMemberRoles } from '../src/roles';
import { insertOrIgnoreAction } from '../src/schema/actions';
import { ReadStream } from 'fs';
import { DataSource } from 'typeorm';

interface ActionRow {
  userId: string;
  type: UserActionType;
}

const streamCallback = (stream: ReadStream) =>
  new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('end', resolve);
  });

const createStreamRunner = (con: DataSource) => {
  let index = 0;

  return async ({ userId, type }: ActionRow) => {
    console.log(`updating ${userId} ${type} ${index}`);
    index++;

    await insertOrIgnoreAction(con, userId, type);
  };
};

const runSourceAdminStream = async (con: DataSource) =>
  con
    .createQueryBuilder()
    .select('DISTINCT sm."userId"')
    .addSelect(`'${UserActionType.CreateSquad}'`, 'type')
    .from(SourceMember, 'sm')
    .where('sm.role = :role', { role: SourceMemberRoles.Admin })
    .stream();

const runSourceNonAdminStream = async (con: DataSource) =>
  con
    .createQueryBuilder()
    .select('DISTINCT sm."userId"')
    .addSelect(`'${UserActionType.JoinSquad}'`, 'type')
    .from(SourceMember, 'sm')
    .where('sm.role != :role', { role: SourceMemberRoles.Admin })
    .stream();

const runFirstCommentStream = async (con: DataSource) =>
  con
    .createQueryBuilder()
    .select('DISTINCT c."userId"')
    .addSelect(`'${UserActionType.SquadFirstComment}'`, 'type')
    .from(Comment, 'c')
    .innerJoin(Post, 'p', 'p.id = c."postId"')
    .where('p.type = :type', { type: PostType.Share })
    .stream();

const runFirstPostStream = async (con: DataSource) =>
  con
    .createQueryBuilder()
    .select('DISTINCT p."authorId"', 'userId')
    .addSelect(`'${UserActionType.SquadFirstPost}'`, 'type')
    .from(Post, 'p')
    .where('p.type = :type', { type: PostType.Share })
    .stream();

const runSquadInviteStream = async (con: DataSource) =>
  con
    .createQueryBuilder()
    .select('DISTINCT u."referralId"', 'userId')
    .addSelect(`'${UserActionType.SquadInvite}'`, 'type')
    .from(User, 'u')
    .where('u."referralId" IS NOT NULL')
    .stream();

const runFilterStream = async (con: DataSource) =>
  con
    .createQueryBuilder()
    .select('DISTINCT a."userId"')
    .addSelect(`'${UserActionType.MyFeed}'`, 'type')
    .from(Alerts, 'a')
    .where('a.filter IS FALSE')
    .stream();

export const retroCheckActions = async (ds?: DataSource): Promise<void> => {
  const con = ds ?? (await createOrGetConnection());
  const adminStream = await runSourceAdminStream(con);
  const nonAdminStream = await runSourceNonAdminStream(con);
  const commentsStream = await runFirstCommentStream(con);
  const postsStream = await runFirstPostStream(con);
  const inviteStream = await runSquadInviteStream(con);
  const filterStream = await runFilterStream(con);
  const streams = [
    commentsStream,
    postsStream,
    inviteStream,
    adminStream,
    nonAdminStream,
    filterStream,
  ];

  streams.forEach((stream) => stream.on('data', createStreamRunner(con)));

  await Promise.all(streams.map(streamCallback));
};

if (process.env.NODE_ENV !== 'test') {
  retroCheckActions();
}

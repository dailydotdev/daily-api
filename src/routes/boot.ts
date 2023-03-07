import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import createOrGetConnection from '../db';
import { DataSource } from 'typeorm';
import { clearAuthentication, dispatchWhoami } from '../kratos';
import { generateTrackingId } from '../ids';
import { generateSessionId, setTrackingId } from '../tracking';
import { IFlags } from '../flagsmith';
import { GQLUser } from '../schema/users';
import {
  Alerts,
  ALERTS_DEFAULT,
  getUnreadNotificationsCount,
  Post,
  Settings,
  SETTINGS_DEFAULT,
  SourceMember,
  SquadSource,
  User,
} from '../entity';
import { GQLSource } from '../schema/sources';
import { adjustFlagsToUser, getUserFeatureFlags } from '../featureFlags';
import { getAlerts } from '../schema/alerts';
import { getSettings } from '../schema/settings';
import { getRedisObject, setRedisObject } from '../redis';
import { REDIS_CHANGELOG_KEY } from '../config';
import { getSourceLink } from '../common';
import { AccessToken, signJwt } from '../auth';
import { cookies, setCookie, setRawCookie } from '../cookies';
import { parse } from 'graphql/language/parser';
import { execute } from 'graphql/execution/execute';
import { schema } from '../graphql';
import { Context } from '../Context';

export type BaseBoot = {
  visit: { visitId: string; sessionId: string };
  flags: IFlags;
  alerts: Omit<Alerts, 'userId'>;
  settings: Omit<Settings, 'userId' | 'updatedAt'>;
  notifications: { unreadNotificationsCount: number };
  squads: (GQLSource & { permalink: string })[];
};

export type AnonymousBoot = BaseBoot & {
  user: { id: string };
  shouldLogout: boolean;
};

export type LoggedInBoot = BaseBoot & {
  user: GQLUser & {
    providers: (string | null)[];
    permalink: string;
    roles: string[];
  };
  accessToken: AccessToken;
};

type BootMiddleware = (
  con: DataSource,
  req: FastifyRequest,
  res: FastifyReply,
) => Promise<Record<string, unknown>>;

const visitSection = async (
  req: FastifyRequest,
  res: FastifyReply,
): Promise<BaseBoot['visit']> => {
  const [visitId, sessionId] = await Promise.all([
    generateTrackingId(),
    generateSessionId(req, res),
  ]);
  return {
    visitId,
    sessionId,
  };
};

const excludeProperties = <T, K extends keyof T>(
  obj: T,
  properties: K[],
): Pick<T, Exclude<keyof T, K>> => {
  if (obj) {
    properties.forEach((prop) => {
      delete obj[prop];
    });
  }
  return obj;
};

const getSquads = async (
  con: DataSource,
  userId: string,
): Promise<(GQLSource & { permalink: string })[]> => {
  const sources = await con
    .createQueryBuilder()
    .select('id')
    .addSelect('type')
    .addSelect('name')
    .addSelect('handle')
    .addSelect('image')
    .addSelect('NOT private', 'public')
    .addSelect('active')
    .from(SourceMember, 'sm')
    .innerJoin(
      SquadSource,
      's',
      'sm."sourceId" = s."id" and s."type" = \'squad\'',
    )
    .where('sm."userId" = :userId', { userId })
    .orderBy('LOWER(s.name)', 'ASC')
    .getRawMany<GQLSource>();
  return sources.map((source) => ({
    ...source,
    permalink: getSourceLink(source),
  }));
};

const moderators = [
  '1d339aa5b85c4e0ba85fdedb523c48d4',
  '28849d86070e4c099c877ab6837c61f0',
  '5e0af68445e04c02b0656c3530664aff',
  'a491ef61599a4b3e84b6dfa602e6bdfe',
  'f7fed619a1de44fe9a896850422e98ff',
  'pUP1hQ0AOZPBvKlViBnGI',
];

const getRoles = (userId: string): string[] => {
  if (moderators.includes(userId)) {
    return ['moderator'];
  }
  return [];
};

const handleNonExistentUser = async (
  con: DataSource,
  req: FastifyRequest,
  res: FastifyReply,
  middleware?: BootMiddleware,
): Promise<AnonymousBoot> => {
  req.log.info(
    { userId: req.userId },
    'could not find the logged user in the api',
  );
  await clearAuthentication(req, res, 'user not found');
  return anonymousBoot(con, req, res, middleware, true);
};

const setAuthCookie = async (
  req: FastifyRequest,
  res: FastifyReply,
  userId: string,
  roles: string[],
): Promise<AccessToken> => {
  const accessToken = await signJwt(
    {
      userId,
      roles,
    },
    15 * 60 * 1000,
  );
  setCookie(req, res, 'auth', accessToken.token);
  return accessToken;
};

const getAndUpdateLastChangelogRedis = async (
  con: DataSource,
): Promise<string> => {
  let lastChangelogFromRedis = await getRedisObject(REDIS_CHANGELOG_KEY);

  if (!lastChangelogFromRedis) {
    const post: Pick<Post, 'createdAt'> = await con
      .getRepository(Post)
      .findOne({
        select: ['createdAt'],
        where: [{ sourceId: 'daily_updates' }],
        order: {
          createdAt: {
            direction: 'DESC',
          },
        },
      });

    if (post) {
      lastChangelogFromRedis = post.createdAt.toISOString();

      await setRedisObject(REDIS_CHANGELOG_KEY, lastChangelogFromRedis);
    }
  }

  return lastChangelogFromRedis;
};

const loggedInBoot = async (
  con: DataSource,
  req: FastifyRequest,
  res: FastifyReply,
  middleware?: BootMiddleware,
): Promise<LoggedInBoot | AnonymousBoot> => {
  const { userId } = req;
  const [
    visit,
    user,
    roles,
    flags,
    alerts,
    settings,
    unreadNotificationsCount,
    squads,
    lastChangelog,
    extra,
  ] = await Promise.all([
    visitSection(req, res),
    con.getRepository(User).findOneBy({ id: userId }),
    getRoles(userId),
    getUserFeatureFlags(req, con),
    getAlerts(con, userId),
    getSettings(con, userId),
    getUnreadNotificationsCount(con, userId),
    getSquads(con, userId),
    getAndUpdateLastChangelogRedis(con),
    middleware ? middleware(con, req, res) : {},
  ]);
  if (!user) {
    return handleNonExistentUser(con, req, res, middleware);
  }
  const accessToken = await setAuthCookie(req, res, userId, roles);

  return {
    user: {
      ...excludeProperties(user, [
        'updatedAt',
        'referralId',
        'profileConfirmed',
        'devcardEligible',
      ]),
      providers: [null],
      roles,
      permalink: `${process.env.COMMENTS_PREFIX}/${user.username || user.id}`,
    },
    visit,
    flags: adjustFlagsToUser(flags, user),
    alerts: {
      ...excludeProperties(alerts, ['userId']),
      // read only, used in frontend to decide if changelog post should be fetched
      changelog: alerts.lastChangelog < new Date(lastChangelog),
    },
    settings: excludeProperties(settings, [
      'userId',
      'updatedAt',
      'bookmarkSlug',
    ]),
    notifications: { unreadNotificationsCount },
    squads,
    accessToken,
    ...extra,
  };
};

const anonymousBoot = async (
  con: DataSource,
  req: FastifyRequest,
  res: FastifyReply,
  middleware?: BootMiddleware,
  shouldLogout = false,
): Promise<AnonymousBoot> => {
  const [visit, flags, extra] = await Promise.all([
    visitSection(req, res),
    getUserFeatureFlags(req, con),
    middleware ? middleware(con, req, res) : {},
  ]);
  return {
    user: {
      id: req.trackingId,
    },
    visit,
    flags,
    alerts: { ...ALERTS_DEFAULT, changelog: false },
    settings: SETTINGS_DEFAULT,
    notifications: { unreadNotificationsCount: 0 },
    squads: [],
    shouldLogout,
    ...extra,
  };
};

export const getBootData = async (
  con: DataSource,
  req: FastifyRequest,
  res: FastifyReply,
  middleware?: BootMiddleware,
): Promise<AnonymousBoot | LoggedInBoot> => {
  const whoami = await dispatchWhoami(req);
  if (whoami.valid) {
    if (whoami.cookie) {
      setRawCookie(res, whoami.cookie);
    }
    if (req.userId !== whoami.userId) {
      req.userId = whoami.userId;
      req.trackingId = req.userId;
      setTrackingId(req, res, req.trackingId);
    }
    return loggedInBoot(con, req, res, middleware);
  } else if (req.userId || req.cookies[cookies.kratos.key]) {
    await clearAuthentication(req, res, 'invalid cookie');
    return anonymousBoot(con, req, res, middleware, true);
  }
  return anonymousBoot(con, req, res, middleware);
};

const COMPANION_QUERY = parse(`query Post($url: String) {
        postByUrl(url: $url) {
          id
          title
          image
          permalink
          commentsPermalink
          trending
          summary
          numUpvotes
          upvoted
          numComments
          bookmarked
          createdAt
          readTime
          tags
          source {
            id
            name
            image
          }
          author {
            id
          }
        }
      }`);

export default async function (fastify: FastifyInstance): Promise<void> {
  const con = await createOrGetConnection();

  fastify.get('/', async (req, res) => {
    const data = await getBootData(con, req, res);
    return res.send(data);
  });

  fastify.get('/companion', async (req, res) => {
    const middleware: BootMiddleware = async (con, req) => {
      const res = await execute({
        schema,
        document: COMPANION_QUERY,
        variableValues: {
          url: (req.query as { url?: string }).url,
        },
        contextValue: new Context(req, con),
      });
      if (res?.data?.postByUrl) {
        return { postData: res.data.postByUrl };
      }
      return {};
    };
    const data = await getBootData(con, req, res, middleware);
    return res.send(data);
  });

  fastify.get('/features', async (req, res) => {
    const data = await getUserFeatureFlags(req, con);
    return res.send(data);
  });
}

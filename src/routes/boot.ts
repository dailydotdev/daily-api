import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import createOrGetConnection from '../db';
import { DataSource, EntityManager } from 'typeorm';
import { clearAuthentication, dispatchWhoami } from '../kratos';
import { generateUUID } from '../ids';
import { generateSessionId, setTrackingId } from '../tracking';
import { GQLUser } from '../schema/users';
import {
  Alerts,
  ALERTS_DEFAULT,
  Banner,
  Feature,
  Settings,
  SETTINGS_DEFAULT,
  SourceMember,
  SquadSource,
  User,
} from '../entity';
import {
  getPermissionsForMember,
  GQLSource,
  SourcePermissions,
} from '../schema/sources';
import { getAlerts } from '../schema/alerts';
import { getSettings } from '../schema/settings';
import {
  getRedisObject,
  ioRedisPool,
  ONE_DAY_IN_SECONDS,
  setRedisObject,
  setRedisObjectWithExpiry,
} from '../redis';
import { generateStorageKey, REDIS_BANNER_KEY, StorageTopic } from '../config';
import { base64, getSourceLink, submitArticleThreshold } from '../common';
import { AccessToken, signJwt } from '../auth';
import { cookies, setCookie, setRawCookie } from '../cookies';
import { parse } from 'graphql/language/parser';
import { execute } from 'graphql/execution/execute';
import { schema } from '../graphql';
import { Context } from '../Context';
import { SourceMemberRoles } from '../roles';
import { getEncryptedFeatures } from '../growthbook';
import { differenceInMinutes } from 'date-fns';
import { runInSpan } from '../telemetry/opentelemetry';
import { getUnreadNotificationsCount } from '../notifications/common';

export type BootSquadSource = Omit<GQLSource, 'currentMember'> & {
  permalink: string;
  currentMember: {
    permissions: SourcePermissions[];
  };
};

export type Experimentation = {
  f: string;
  e: string[];
  a: Record<string, unknown>;
};

export type BaseBoot = {
  visit: { visitId: string; sessionId: string };
  alerts: Omit<Alerts, 'userId' | 'flags'>;
  settings: Omit<Settings, 'userId' | 'updatedAt'>;
  notifications: { unreadNotificationsCount: number };
  squads: BootSquadSource[];
  exp?: Experimentation;
};

export type BootUserReferral = Partial<{
  referralId?: string;
  referralOrigin?: string;
}>;

interface AnonymousUser extends BootUserReferral {
  id: string;
  firstVisit: string;
  shouldVerify?: boolean;
  email?: string;
}

export type AnonymousBoot = BaseBoot & {
  user: AnonymousUser;
};

export type LoggedInBoot = BaseBoot & {
  user: GQLUser & {
    providers: (string | null)[];
    permalink: string;
    roles: string[];
    canSubmitArticle: boolean;
  };
  accessToken: AccessToken;
  marketingCta: null;
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
    generateUUID(),
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
): Promise<BootSquadSource[]> =>
  runInSpan('getSquads', async () => {
    const sources = await con
      .createQueryBuilder()
      .select('id')
      .addSelect('type')
      .addSelect('name')
      .addSelect('handle')
      .addSelect('image')
      .addSelect('NOT private', 'public')
      .addSelect('active')
      .addSelect('role')
      .addSelect('"memberPostingRank"')
      .from(SourceMember, 'sm')
      .innerJoin(
        SquadSource,
        's',
        'sm."sourceId" = s."id" and s."type" = \'squad\'',
      )
      .where('sm."userId" = :userId', { userId })
      .andWhere('sm."role" != :role', { role: SourceMemberRoles.Blocked })
      .orderBy('LOWER(s.name)', 'ASC')
      .getRawMany<
        GQLSource & { role: SourceMemberRoles; memberPostingRank: number }
      >();

    return sources.map((source) => {
      const { role, memberPostingRank, ...restSource } = source;

      const permissions = getPermissionsForMember(
        { role },
        { memberPostingRank },
      );
      // we only send posting permissions from boot to keep the payload small
      const postingPermissions = permissions.filter(
        (item) => item === SourcePermissions.Post,
      );

      return {
        ...restSource,
        permalink: getSourceLink(source),
        currentMember: {
          permissions: postingPermissions,
        },
      };
    });
  });

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
  return anonymousBoot(con, req, res, middleware);
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

const getAndUpdateLastBannerRedis = async (
  con: DataSource,
): Promise<string> => {
  let bannerFromRedis = await getRedisObject(REDIS_BANNER_KEY);

  if (!bannerFromRedis) {
    const banner = await con.getRepository(Banner).findOne({
      select: ['timestamp'],
      where: [],
      order: {
        timestamp: {
          direction: 'DESC',
        },
      },
    });

    if (banner) {
      bannerFromRedis = banner.timestamp.toISOString();
      await setRedisObject(REDIS_BANNER_KEY, bannerFromRedis);
    }
  }

  return bannerFromRedis;
};

export function getReferralFromCookie({
  req,
}: {
  req: FastifyRequest;
}): BootUserReferral | undefined {
  const joinReferralCookie = req.cookies.join_referral;

  if (!joinReferralCookie) {
    return undefined;
  }

  const [referralId, referralOrigin] = joinReferralCookie.split(':');

  if (!referralId || !referralOrigin) {
    return undefined;
  }

  return {
    referralId,
    referralOrigin,
  };
}

const getExperimentation = async (
  userId: string,
  con: DataSource | EntityManager,
): Promise<Experimentation> => {
  if (userId) {
    const [hash, features] = await Promise.all([
      ioRedisPool.execute((client) => client.hgetall(`exp:${userId}`)),
      con
        .getRepository(Feature)
        .find({ where: { userId }, select: ['feature', 'value'] }),
    ]);
    const e = Object.keys(hash || {}).map((key) => {
      const [variation] = hash[key].split(':');
      return base64(`${key}:${variation}`);
    });
    return {
      f: getEncryptedFeatures(),
      e,
      a: features.reduce(
        (acc, { feature, value }) => ({ [feature]: value, ...acc }),
        {},
      ),
    };
  }
  return {
    f: getEncryptedFeatures(),
    e: [],
    a: {},
  };
};

const getUser = (con: DataSource, userId: string): Promise<User> =>
  con.getRepository(User).findOne({
    where: { id: userId },
    select: [
      'id',
      'username',
      'name',
      'email',
      'image',
      'company',
      'title',
      'infoConfirmed',
      'notificationEmail',
      'acceptedMarketing',
      'reputation',
      'bio',
      'twitter',
      'github',
      'portfolio',
      'hashnode',
      'timezone',
      'createdAt',
      'cover',
    ],
  });

const loggedInBoot = async (
  con: DataSource,
  req: FastifyRequest,
  res: FastifyReply,
  refreshToken: boolean,
  middleware?: BootMiddleware,
): Promise<LoggedInBoot | AnonymousBoot> =>
  runInSpan('loggedInBoot', async () => {
    const { userId } = req;
    const [
      visit,
      user,
      roles,
      alerts,
      settings,
      unreadNotificationsCount,
      squads,
      lastBanner,
      exp,
      extra,
    ] = await Promise.all([
      visitSection(req, res),
      getUser(con, userId),
      getRoles(userId),
      getAlerts(con, userId),
      getSettings(con, userId),
      getUnreadNotificationsCount(con, userId),
      getSquads(con, userId),
      getAndUpdateLastBannerRedis(con),
      getExperimentation(userId, con),
      middleware ? middleware(con, req, res) : {},
    ]);
    if (!user) {
      return handleNonExistentUser(con, req, res, middleware);
    }
    const accessToken = refreshToken
      ? await setAuthCookie(req, res, userId, roles)
      : req.accessToken;

    return {
      user: {
        ...excludeProperties(user, [
          'updatedAt',
          'referralId',
          'referralOrigin',
          'profileConfirmed',
          'devcardEligible',
        ]),
        providers: [null],
        roles,
        permalink: `${process.env.COMMENTS_PREFIX}/${user.username || user.id}`,
        canSubmitArticle: user.reputation >= submitArticleThreshold,
      },
      visit,
      alerts: {
        ...excludeProperties(alerts, ['userId']),
        // We decided to try and turn off the changelog for now in favor of squad promotion
        // PR: https://github.com/dailydotdev/daily-api/pull/1633
        changelog: false,
        // read only, used in frontend to decide if banner should be fetched
        banner:
          lastBanner !== 'false' && alerts.lastBanner < new Date(lastBanner),
      },
      settings: excludeProperties(settings, [
        'userId',
        'updatedAt',
        'bookmarkSlug',
      ]),
      notifications: { unreadNotificationsCount },
      squads,
      accessToken,
      exp,
      marketingCta: null,
      ...extra,
    };
  });

const getAnonymousFirstVisit = async (trackingId: string) => {
  if (!trackingId) return null;

  const key = generateStorageKey(StorageTopic.Boot, 'first_visit', trackingId);
  const firstVisit = await getRedisObject(key);
  const finalValue = firstVisit ?? new Date().toISOString();

  await setRedisObjectWithExpiry(key, finalValue, ONE_DAY_IN_SECONDS * 30);

  return finalValue;
};

// We released the firstVisit at July 10, 2023.
// There should have been enough buffer time since we are releasing on July 13, 2023.
export const onboardingV2Requirement = new Date(2023, 6, 13);

const anonymousBoot = async (
  con: DataSource,
  req: FastifyRequest,
  res: FastifyReply,
  middleware?: BootMiddleware,
  shouldVerify = false,
  email?: string,
): Promise<AnonymousBoot> => {
  const [visit, extra, firstVisit, exp] = await Promise.all([
    visitSection(req, res),
    middleware ? middleware(con, req, res) : {},
    getAnonymousFirstVisit(req.trackingId),
    getExperimentation(req.trackingId, con),
  ]);

  return {
    user: {
      firstVisit,
      id: req.trackingId,
      ...getReferralFromCookie({ req }),
      ...(shouldVerify && { email }),
      shouldVerify,
    },
    visit,
    alerts: { ...ALERTS_DEFAULT, changelog: false },
    settings: SETTINGS_DEFAULT,
    notifications: { unreadNotificationsCount: 0 },
    squads: [],
    exp,
    ...extra,
  };
};

export const getBootData = async (
  con: DataSource,
  req: FastifyRequest,
  res: FastifyReply,
  middleware?: BootMiddleware,
): Promise<AnonymousBoot | LoggedInBoot> => {
  if (
    req.userId &&
    req.accessToken?.expiresIn &&
    differenceInMinutes(req.accessToken?.expiresIn, new Date()) > 3
  ) {
    return loggedInBoot(con, req, res, false, middleware);
  }

  const whoami = await dispatchWhoami(req);
  if (whoami.valid) {
    if (whoami.cookie) {
      setRawCookie(res, whoami.cookie);
    }
    if (whoami.verified === false) {
      return anonymousBoot(con, req, res, middleware, true, whoami?.email);
    }
    if (req.userId !== whoami.userId) {
      req.userId = whoami.userId;
      req.trackingId = req.userId;
      setTrackingId(req, res, req.trackingId);
    }
    return loggedInBoot(con, req, res, true, middleware);
  } else if (req.cookies[cookies.kratos.key]) {
    await clearAuthentication(req, res, 'invalid cookie');
    return anonymousBoot(con, req, res, middleware);
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
          downvoted
          userState {
            vote
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
}

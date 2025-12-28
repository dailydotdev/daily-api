import {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RouteHandler,
} from 'fastify';
import createOrGetConnection from '../db';
import { DataSource, Not, QueryRunner } from 'typeorm';
import { clearAuthentication, dispatchWhoami } from '../kratos';
import { generateUUID } from '../ids';
import { generateSessionId, setTrackingId } from '../tracking';
import { GQLUser, getMarketingCta } from '../schema/users';
import {
  Alerts,
  ALERTS_DEFAULT,
  Banner,
  Feature,
  Feed,
  MarketingCta,
  Settings,
  SETTINGS_DEFAULT,
  SourceMember,
  SquadSource,
  User,
} from '../entity';
import { UserExperience } from '../entity/user/experiences/UserExperience';
import { UserExperienceType } from '../entity/user/experiences/types';
import { DatasetLocation } from '../entity/dataset/DatasetLocation';
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
  setRedisObject,
  setRedisObjectWithExpiry,
} from '../redis';
import {
  FEED_SURVEY_INTERVAL,
  generateStorageKey,
  MODERATORS,
  REDIS_BANNER_KEY,
  StorageKey,
  StorageTopic,
} from '../config';

import {
  ONE_DAY_IN_SECONDS,
  base64,
  getSourceLink,
  submitArticleThreshold,
  mapCloudinaryUrl,
  THREE_MONTHS_IN_SECONDS,
  isTest,
} from '../common';
import { AccessToken, signJwt } from '../auth';
import { cookies, setCookie, setRawCookie } from '../cookies';
import { parse } from 'graphql/language/parser';
import { execute } from 'graphql/execution/execute';
import { schema } from '../graphql';
import { Context } from '../Context';
import { SourceMemberRoles } from '../roles';
import {
  ExperimentAllocationClient,
  getEncryptedFeatures,
  getUserGrowthBookInstance,
} from '../growthbook';
import { differenceInMinutes, isSameDay, subDays } from 'date-fns';
import {
  runInSpan,
  SEMATTRS_DAILY_APPS_USER_ID,
  SEMATTRS_DAILY_STAFF,
} from '../telemetry';
import { getUnreadNotificationsCount } from '../notifications/common';
import { maxFeedsPerUser, type CoresRole, type TLocation } from '../types';
import { queryReadReplica } from '../common/queryReadReplica';
import { queryDataSource } from '../common/queryDataSource';
import { isPlusMember } from '../paddle';
import { Continent, countryCodeToContinent } from '../common/geo';
import { getBalance, type GetBalanceResult } from '../common/njord';
import { logger } from '../logger';
import { freyjaClient, type FunnelState } from '../integrations/freyja';
import { isUserPartOfOrganization } from '../common/plus';
import { remoteConfig, RemoteConfigValue } from '../remoteConfig';

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

export type Geo = {
  region?: string;
  continent?: Continent;
};

interface ComputedAlerts {
  shouldShowFeedFeedback: boolean;
}

type PublicAlerts = Omit<
  Alerts,
  'userId' | 'flags' | 'user' | 'lastFeedSettingsFeedback'
>;

export type BootAlerts = PublicAlerts & ComputedAlerts;

export type BaseBoot = {
  visit: { visitId: string; sessionId: string };
  alerts: BootAlerts;
  settings: Omit<Settings, 'userId' | 'updatedAt' | 'user'>;
  notifications: { unreadNotificationsCount: number };
  squads: BootSquadSource[];
  exp?: Experimentation;
  geo: Geo;
};

export type BootUserReferral = Partial<{
  referralId?: string;
  referralOrigin?: string;
}>;

interface AnonymousUser extends BootUserReferral {
  id?: string;
  firstVisit: string | null;
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
    balance: GetBalanceResult;
    coresRole: CoresRole;
    location?: TLocation | null;
    profileCompletion?: ProfileCompletion | null;
  };
  accessToken?: AccessToken;
  marketingCta: MarketingCta | null;
};

export type FunnelLoggedInUser = GQLUser & {
  providers: (string | null)[];
  permalink: string;
};

export type FunnelBoot = AnonymousBoot & {
  user: FunnelLoggedInUser | AnonymousUser;
  funnelState: FunnelState;
};

type BootMiddleware = (
  con: DataSource,
  req: FastifyRequest,
  res: FastifyReply,
) => Promise<Record<string, unknown>>;

const geoSection = (req: FastifyRequest): BaseBoot['geo'] => {
  const region = req.headers['x-client-region'] as string;

  return {
    region,
    continent: countryCodeToContinent[region],
  };
};

const getClickbaitTries = async ({ userId }: { userId: string }) => {
  const key = generateStorageKey(
    StorageTopic.RedisCounter,
    'fetchSmartTitle',
    userId,
  );
  return await getRedisObject(key);
};

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

export const excludeProperties = <T, K extends keyof T>(
  obj: T,
  properties: K[],
): Pick<T, Exclude<keyof T, K>> => {
  if (!obj) {
    return obj;
  }

  const clone = structuredClone(obj);

  properties.forEach((prop) => {
    delete clone[prop];
  });

  return clone;
};

export const includeProperties = <T, K extends keyof T>(
  obj: T,
  properties: K[],
): Pick<T, K> => {
  if (!obj) {
    return obj;
  }

  const clone = structuredClone(obj);
  const keys = Object.keys(clone) as K[];
  keys.forEach((key) => {
    if (!properties.includes(key)) {
      delete clone[key];
    }
  });

  return clone;
};

const getSquads = async (
  con: DataSource | QueryRunner,
  userId: string,
): Promise<BootSquadSource[]> =>
  runInSpan('getSquads', async () => {
    const sources = await con.manager
      .createQueryBuilder()
      .select('id')
      .addSelect('type')
      .addSelect('name')
      .addSelect('handle')
      .addSelect('image')
      .addSelect('NOT private', 'public')
      .addSelect('active')
      .addSelect('role')
      .addSelect('"moderationRequired"')
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
      const { role, memberPostingRank, image, ...restSource } = source;

      const permissions = getPermissionsForMember(
        { role },
        { memberPostingRank },
      );
      // we only send posting and moderation permissions from boot to keep the payload small
      const essentialPermissions = permissions.filter(
        (item) =>
          item === SourcePermissions.Post ||
          item === SourcePermissions.ModeratePost,
      );
      return {
        ...restSource,
        image: mapCloudinaryUrl(image),
        permalink: getSourceLink(source),
        currentMember: {
          permissions: essentialPermissions,
        },
      };
    });
  });

const getFeeds = async ({
  con,
  userId,
}: {
  con: DataSource | QueryRunner;
  userId: string;
}): Promise<Feed[]> => {
  return con.manager.getRepository(Feed).find({
    where: {
      id: Not(userId),
      userId,
    },
    take: maxFeedsPerUser,
  });
};

const getRoles = (userId: string): string[] => {
  if (MODERATORS.includes(userId)) {
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
  isTeamMember: boolean,
  isPlus: boolean,
): Promise<AccessToken> => {
  const accessToken = await signJwt(
    {
      userId,
      roles,
      isTeamMember,
      isPlus,
    },
    15 * 60 * 1000,
  );
  setCookie(req, res, 'auth', accessToken.token);
  return accessToken;
};

const getAndUpdateLastBannerRedis = async (
  con: DataSource | QueryRunner,
): Promise<string | null> => {
  let bannerFromRedis = await getRedisObject(REDIS_BANNER_KEY);

  if (!bannerFromRedis) {
    const banner = await con.manager.getRepository(Banner).findOne({
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

const getExperimentation = async ({
  userId,
  con,
  region,
}: {
  userId?: string;
  con: DataSource | QueryRunner;
  region?: string;
}): Promise<Experimentation> => {
  if (userId) {
    const [hash, features] = await Promise.all([
      ioRedisPool.execute((client) => client.hgetall(`exp:${userId}`)),
      con.manager
        .getRepository(Feature)
        .find({ where: { userId }, select: ['feature', 'value'] }),
    ]);
    const e = Object.keys(hash || {}).map((key) => {
      const [variation] = hash[key].split(':');
      return base64(`${key}:${variation}`);
    });
    const a: Experimentation['a'] = features.reduce(
      (acc, { feature, value }) => ({ [feature]: value, ...acc }),
      {},
    );
    if (region) {
      a.region = region;
    }
    return {
      f: getEncryptedFeatures(),
      e,
      a,
    };
  }
  return {
    f: getEncryptedFeatures(),
    e: [],
    a: {},
  };
};

const getUser = (
  con: DataSource | QueryRunner,
  userId: string,
): Promise<User | null> =>
  con.manager.getRepository(User).findOne({
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
      'reputation',
      'bio',
      'twitter',
      'bluesky',
      'github',
      'portfolio',
      'hashnode',
      'roadmap',
      'threads',
      'codepen',
      'reddit',
      'stackoverflow',
      'youtube',
      'linkedin',
      'mastodon',
      'timezone',
      'createdAt',
      'cover',
      'experienceLevel',
      'language',
      'subscriptionFlags',
      'defaultFeedId',
      'flags',
      'coresRole',
      'locationId',
      'readme',
      'language',
      'hideExperience',
    ],
  });

const getBalanceBoot: typeof getBalance = async ({ userId }) => {
  try {
    const result = await getBalance({ userId });

    return result;
  } catch (originalError) {
    logger.debug({ err: originalError }, 'getBalanceBoot error');

    // in case of issues with fetching balance we return zero balance
    return {
      amount: 0,
    };
  }
};

const getLocation = async (
  con: DataSource | QueryRunner,
  userId: string | null,
): Promise<Pick<
  DatasetLocation,
  'id' | 'city' | 'subdivision' | 'country'
> | null> => {
  if (!userId) {
    return null;
  }

  const location = await con.manager
    .createQueryBuilder(DatasetLocation, 'location')
    .innerJoin(User, 'user', 'user.locationId = location.id')
    .select([
      'location.id',
      'location.city',
      'location.subdivision',
      'location.country',
      'location.externalId',
    ])
    .where('user.id = :userId', { userId })
    .getOne();

  return location;
};

export type ProfileCompletion = {
  percentage: number;
  hasProfileImage: boolean;
  hasHeadline: boolean;
  hasExperienceLevel: boolean;
  hasWork: boolean;
  hasEducation: boolean;
};

type ProfileExperienceFlags = {
  hasWork: boolean;
  hasEducation: boolean;
};

const getProfileExperienceFlags = async (
  con: DataSource | QueryRunner,
  userId: string,
): Promise<ProfileExperienceFlags> => {
  // Check if user has work and education experiences using efficient EXISTS queries
  const [hasWork, hasEducation] = await Promise.all([
    con.manager
      .createQueryBuilder(UserExperience, 'ue')
      .select('1')
      .where('ue.userId = :userId', { userId })
      .andWhere('ue.type = :type', { type: UserExperienceType.Work })
      .limit(1)
      .getRawOne()
      .then((result) => !!result),
    con.manager
      .createQueryBuilder(UserExperience, 'ue')
      .select('1')
      .where('ue.userId = :userId', { userId })
      .andWhere('ue.type = :type', { type: UserExperienceType.Education })
      .limit(1)
      .getRawOne()
      .then((result) => !!result),
  ]);

  return { hasWork, hasEducation };
};

const calculateProfileCompletion = (
  user: User | null,
  experienceFlags: ProfileExperienceFlags | null,
): ProfileCompletion | null => {
  if (!user || !experienceFlags) {
    return null;
  }

  // Calculate completion based on 5 items (each worth 20%)
  const hasProfileImage = !!user.image && user.image !== '';
  const hasHeadline = !!user.bio && user.bio.trim() !== '';
  const hasExperienceLevel = !!user.experienceLevel;
  const { hasWork, hasEducation } = experienceFlags;

  const completedItems = [
    hasProfileImage,
    hasHeadline,
    hasExperienceLevel,
    hasWork,
    hasEducation,
  ].filter(Boolean).length;

  const percentage = Math.round((completedItems / 5) * 100);
  return {
    percentage,
    hasProfileImage,
    hasHeadline,
    hasExperienceLevel,
    hasWork,
    hasEducation,
  };
};

const loggedInBoot = async ({
  con,
  req,
  res,
  refreshToken,
  middleware,
  userId,
}: {
  con: DataSource;
  req: FastifyRequest;
  res: FastifyReply;
  refreshToken: boolean;
  middleware?: BootMiddleware;
  userId: string;
}): Promise<LoggedInBoot | AnonymousBoot> =>
  runInSpan('loggedInBoot', async (span) => {
    span?.setAttribute(SEMATTRS_DAILY_APPS_USER_ID, userId);

    const geo = geoSection(req);

    const { log } = req;

    const [
      visit,
      roles,
      extra,
      [alerts, settings, marketingCta],
      [
        user,
        squads,
        lastBanner,
        exp,
        feeds,
        unreadNotificationsCount,
        location,
        experienceFlags,
      ],
      balance,
      clickbaitTries,
    ] = await Promise.all([
      visitSection(req, res),
      getRoles(userId),
      middleware ? middleware(con, req, res) : {},
      queryDataSource(con, ({ queryRunner }) => {
        return Promise.all([
          getAlerts(queryRunner, userId),
          getSettings(queryRunner, userId),
          getMarketingCta(queryRunner, log, userId),
        ]);
      }),
      queryReadReplica(con, async ({ queryRunner }) => {
        return Promise.all([
          getUser(queryRunner, userId),
          getSquads(queryRunner, userId),
          getAndUpdateLastBannerRedis(queryRunner),
          getExperimentation({ userId, con: queryRunner, ...geo }),
          getFeeds({ con: queryRunner, userId }),
          getUnreadNotificationsCount(queryRunner, userId),
          getLocation(queryRunner, userId),
          getProfileExperienceFlags(queryRunner, userId),
        ]);
      }),
      getBalanceBoot({ userId }),
      getClickbaitTries({ userId }),
    ]);

    const profileCompletion = calculateProfileCompletion(user, experienceFlags);

    if (!user) {
      return handleNonExistentUser(con, req, res, middleware);
    }

    const hasLocationSet = !!user.flags?.location?.lastStored;
    const isTeamMember = exp?.a?.team === 1;
    const isPlus = isPlusMember(user.subscriptionFlags?.cycle);

    if (isPlus) {
      exp.a.plus = 1;
    }

    span?.setAttribute(SEMATTRS_DAILY_STAFF, isTeamMember);

    const accessToken =
      refreshToken || isPlus !== req.isPlus
        ? await setAuthCookie(req, res, userId, roles, isTeamMember, isPlus)
        : req.accessToken;
    return {
      user: {
        ...excludeProperties(user, [
          'updatedAt',
          'referralId',
          'referralOrigin',
          'devcardEligible',
          'image',
          'cover',
          'subscriptionFlags',
          'flags',
          'locationId',
          'readmeHtml',
        ]),
        providers: [null],
        roles,
        permalink: `${process.env.COMMENTS_PREFIX}/${user.username || user.id}`,
        canSubmitArticle: user.reputation >= submitArticleThreshold,
        isTeamMember,
        isPlus,
        language: user.language || undefined,
        image: mapCloudinaryUrl(user.image),
        cover: mapCloudinaryUrl(user.cover),
        defaultFeedId: isPlus ? user.defaultFeedId : null,
        flags: {
          showPlusGift: Boolean(user?.flags?.showPlusGift),
        },
        balance,
        subscriptionFlags: {
          provider: user.subscriptionFlags?.provider,
          appAccountToken: user.subscriptionFlags?.appAccountToken,
          status: user.subscriptionFlags?.status,
        },
        clickbaitTries,
        hasLocationSet,
        location,
        profileCompletion,
      },
      visit,
      alerts: {
        ...excludeProperties(alerts, ['userId', 'lastFeedSettingsFeedback']),
        // We decided to try and turn off the changelog for now in favor of squad promotion
        // PR: https://github.com/dailydotdev/daily-api/pull/1633
        changelog: false,
        // read only, used in frontend to decide if banner should be fetched
        banner:
          !!lastBanner &&
          lastBanner !== 'false' &&
          !!alerts.lastBanner &&
          alerts.lastBanner < new Date(lastBanner),
        // read only, used in frontend to decide if boot popup should be shown
        bootPopup: alerts.lastBootPopup
          ? !isSameDay(alerts.lastBootPopup, new Date())
          : true,
        shouldShowFeedFeedback:
          subDays(new Date(), FEED_SURVEY_INTERVAL) >
          alerts.lastFeedSettingsFeedback,
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
      marketingCta,
      feeds,
      geo,
      ...extra,
    };
  });

const getAnonymousFirstVisit = async (trackingId?: string) => {
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
  const geo = geoSection(req);

  const [visit, extra, firstVisit, exp] = await Promise.all([
    visitSection(req, res),
    middleware ? middleware(con, req, res) : {},
    getAnonymousFirstVisit(req.trackingId),
    getExperimentation({ userId: req.trackingId, con, ...geo }),
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
    alerts: {
      ...excludeProperties(ALERTS_DEFAULT, ['lastFeedSettingsFeedback']),
      changelog: false,
      shouldShowFeedFeedback: false,
    },
    settings: SETTINGS_DEFAULT,
    notifications: { unreadNotificationsCount: 0 },
    squads: [],
    exp,
    geo,
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
    return loggedInBoot({
      con,
      req,
      res,
      refreshToken: false,
      middleware,
      userId: req.userId,
    });
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
    return loggedInBoot({
      con,
      req,
      res,
      refreshToken: true,
      middleware,
      userId: req.userId,
    });
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

const allocationClient = new ExperimentAllocationClient();
// Uses Growthbook to resolve the funnel id
const resolveDynamicFunnelId = (
  featureKey: FunnelBootConfig['featureKey'],
  userId: string,
): string => {
  const gbClient = getUserGrowthBookInstance(userId, {
    allocationClient,
  });
  if (!process.env.GROWTHBOOK_API_CONFIG_CLIENT_KEY && !isTest) {
    // In development, we use a static value for the feature key
    return remoteConfig?.vars?.funnelIds?.[featureKey] || 'off';
  }
  return gbClient.getFeatureValue(featureKey, 'off');
};

const shouldResumeSession = (
  sessionFunnel: FunnelState,
  userId?: string,
  id?: string,
  version?: string,
): boolean => {
  // If there's no session
  if (!sessionFunnel?.session) {
    return false;
  }
  // If the session user and current user don't match
  if (sessionFunnel.session.userId !== userId) {
    return false;
  }
  // If the funnel id is set and doesn't match the session funnel id
  if (id && sessionFunnel.funnel.id !== id) {
    return false;
  }
  // If the funnel version is set and doesn't match the session funnel version
  if (version && sessionFunnel.funnel.version !== parseInt(version)) {
    return false;
  }
  return true;
};

// Fetches the funnel data from Freyja
const getFunnel = async (
  req: FastifyRequest,
  res: FastifyReply,
  featureKey: FunnelBootConfig['featureKey'],
  sessionId: string | undefined,
) => {
  const userId = req.userId || req.trackingId;
  const query = req.query as { id?: string; v?: string };

  if (!userId) {
    throw new Error('User ID is required');
  }

  // If the session id is set, we should use it to fetch the funnel data
  if (sessionId) {
    const sessionFunnel = await freyjaClient.getSession(sessionId);
    if (shouldResumeSession(sessionFunnel, userId, query.id, query.v)) {
      return sessionFunnel;
    }
  }

  // If the funnel id is not set, we should resolve it using Growthbook
  if (!query.id) {
    query.id = resolveDynamicFunnelId(featureKey, userId);
    query.v = undefined;
  }

  const funnel = await freyjaClient.createSession(
    userId,
    query.id,
    query.v ? Number(query.v) : undefined,
  );

  const getCookieKeyFromFeatureKey = (
    featureKey: FunnelBootConfig['featureKey'],
  ) => {
    return Object.entries(funnelBoots).reduce(
      (acc, [funnelKey, funnelConfig]) => {
        if (funnelConfig.featureKey === featureKey) {
          return funnelKey;
        }
        return acc;
      },
      'funnel',
    );
  };
  const cookieKey = getCookieKeyFromFeatureKey(featureKey);

  try {
    setCookie(req, res, cookieKey, funnel.session.id);
  } catch (error) {
    logger.error(
      { err: error, featureKey, userId, cookieKey, funnel },
      'failed to set funnel cookie',
    );

    throw error;
  }

  return funnel;
};

// Fetches the logged-in user data (if available)
const getFunnelLoggedInData = async (
  con: DataSource,
  req: FastifyRequest,
): Promise<FunnelLoggedInUser | null> => {
  const { userId } = req;
  if (userId) {
    const user = await queryReadReplica(con, ({ queryRunner }) =>
      getUser(queryRunner, userId),
    );
    if (user) {
      return {
        ...excludeProperties(user, [
          'updatedAt',
          'referralId',
          'referralOrigin',
          'devcardEligible',
          'image',
          'cover',
          'subscriptionFlags',
          'flags',
          'locationId',
          'readmeHtml',
          'readme',
        ]),
        providers: [null],
        permalink: `${process.env.COMMENTS_PREFIX}/${user.username || user.id}`,
        language: user.language || undefined,
        image: mapCloudinaryUrl(user.image),
        cover: mapCloudinaryUrl(user.cover),
      };
    }
  }
  return null;
};

/**
 * Generates middleware for handling funnel boot processing in a web application.
 *
 * @param {FunnelBootConfig} funnel - The configuration object containing settings
 *                                    for the funnel, such as cookie key and feature key.
 * @returns {BootMiddleware} An async middleware function that processes the request,
 *                           retrieves the funnel state, and optionally user-related data.
 */
const generateFunnelBootMiddle = (funnel: FunnelBootConfig): BootMiddleware => {
  return async (
    con,
    req,
    res,
  ): Promise<
    Pick<FunnelBoot, 'funnelState'> & { user?: FunnelLoggedInUser }
  > => {
    const sessionId = req.cookies[funnel.cookieKey];
    const [funnelState, user] = await Promise.all([
      getFunnel(req, res, funnel.featureKey, sessionId),
      getFunnelLoggedInData(con, req),
    ]);
    if (user) {
      return {
        user,
        funnelState,
      };
    }
    return {
      funnelState,
    };
  };
};

type FunnelBootConfig = {
  featureKey: keyof RemoteConfigValue['funnelIds'];
  cookieKey: string;
};

const funnelBoots = {
  funnel: {
    featureKey: 'web_funnel_id',
    cookieKey: cookies.funnel.key,
  } satisfies FunnelBootConfig,
  onboarding: {
    featureKey: 'onboarding_funnel_id',
    cookieKey: cookies.onboarding.key,
  } satisfies FunnelBootConfig,
} as const;

/**
 * Handles incoming requests for funnel-related boot endpoints.
 * This function retrieves the funnel data for a specific funnel type, identified by the `id` parameter.
 * If not provided, it defaults to the 'funnel' funnel configuration from {funnelBoots}.
 *
 * @type {RouteHandler}
 * @param {Request} req
 * @param {Response} res
 * @throws {Error} May throw errors related to database connection or request processing.
 */
const funnelHandler: RouteHandler = async (req, res) => {
  const con = await createOrGetConnection();
  const { id = 'funnel' } = req.params as { id: keyof typeof funnelBoots };

  if (id in funnelBoots) {
    const funnel = funnelBoots[id];
    const data = (await anonymousBoot(
      con,
      req,
      res,
      generateFunnelBootMiddle(funnel),
    )) as FunnelBoot;
    return res.send(data);
  }

  return res.status(404).send({ error: 'Funnel not found' });
};

export default async function (fastify: FastifyInstance): Promise<void> {
  const con = await createOrGetConnection();

  fastify.addHook('onResponse', async (req, res) => {
    if (!req.userId || res.statusCode !== 200) {
      return;
    }

    if (await isUserPartOfOrganization(con, req.userId)) {
      await setRedisObjectWithExpiry(
        generateStorageKey(
          StorageTopic.Boot,
          StorageKey.UserLastOnline,
          req.userId,
        ),
        Date.now().toString(),
        THREE_MONTHS_IN_SECONDS,
      );
    }
  });

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

  // legacy endpoint for web funnel
  fastify.get('/funnel', funnelHandler);

  // Used to get the boot data for the web funnels
  fastify.get('/funnels/:id', funnelHandler);
}

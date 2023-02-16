import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getAlerts } from '../schema/alerts';
import createOrGetConnection from '../db';
import { getSettings } from '../schema/settings';
import {
  ALERTS_DEFAULT,
  getUnreadNotificationsCount,
  SETTINGS_DEFAULT,
  SourceMember,
  SquadSource,
} from '../entity';
import { DataSource } from 'typeorm';
import { getSourceLink } from '../common';
import { GQLSource } from '../schema/sources';
import { getRedisObject } from '../redis';
import { REDIS_CHANGELOG_KEY } from '../config';
import { getInternalFeatureFlags } from '../featureFlags';

const excludeProperties = <T, K extends keyof T>(
  obj: T,
  properties: K[],
): Omit<T, Exclude<keyof T, K>> => {
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

const loggedInBoot = async (
  con: DataSource,
  req: FastifyRequest,
  res: FastifyReply,
): Promise<void> => {
  const { userId } = req;
  const [
    alerts,
    settings,
    unreadNotificationsCount,
    squads,
    lastChangelog,
    features,
  ] = await Promise.all([
    getAlerts(con, userId),
    getSettings(con, userId),
    getUnreadNotificationsCount(con, userId),
    getSquads(con, userId),
    getRedisObject(REDIS_CHANGELOG_KEY),
    getInternalFeatureFlags(con, userId),
  ]);
  return res.send({
    alerts: {
      ...excludeProperties(alerts, ['userId']),
      changelog: alerts.lastChangelog < new Date(lastChangelog),
    },
    settings: excludeProperties(settings, [
      'userId',
      'updatedAt',
      'bookmarkSlug',
    ]),
    notifications: { unreadNotificationsCount },
    squads,
    features,
  });
};

const anonymousBoot = async (
  con: DataSource,
  req: FastifyRequest,
  res: FastifyReply,
): Promise<void> => {
  return res.send({
    alerts: { ...ALERTS_DEFAULT, changelog: false },
    settings: SETTINGS_DEFAULT,
    notifications: { unreadNotificationsCount: 0 },
    squads: [],
    features: {},
  });
};

export default async function (fastify: FastifyInstance): Promise<void> {
  const con = await createOrGetConnection();

  fastify.get('/', async (req, res) => {
    const { userId } = req;
    if (userId) {
      return loggedInBoot(con, req, res);
    }
    return anonymousBoot(con, req, res);
  });
}

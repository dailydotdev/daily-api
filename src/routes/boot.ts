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
import { getUserFeatureFlags } from '../featureFlags';
import { IFlags } from '../flagsmith';

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

const sharedBoot = async (
  con: DataSource,
  req: FastifyRequest,
): Promise<{ features: IFlags; flags: IFlags }> => {
  const [flags] = await Promise.all([getUserFeatureFlags(req, con)]);
  return {
    features: flags,
    flags,
  };
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
    shared,
  ] = await Promise.all([
    getAlerts(con, userId),
    getSettings(con, userId),
    getUnreadNotificationsCount(con, userId),
    getSquads(con, userId),
    getRedisObject(REDIS_CHANGELOG_KEY),
    sharedBoot(con, req),
  ]);
  return res.send({
    ...shared,
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
  });
};

const anonymousBoot = async (
  con: DataSource,
  req: FastifyRequest,
  res: FastifyReply,
): Promise<void> => {
  const shared = await sharedBoot(con, req);
  return res.send({
    ...shared,
    alerts: { ...ALERTS_DEFAULT, changelog: false },
    settings: SETTINGS_DEFAULT,
    notifications: { unreadNotificationsCount: 0 },
    squads: [],
  });
};

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req, res) => {
    const con = await createOrGetConnection();
    const { userId } = req;
    if (userId) {
      return loggedInBoot(con, req, res);
    }
    return anonymousBoot(con, req, res);
  });
}

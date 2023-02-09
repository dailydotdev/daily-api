import { FastifyInstance } from 'fastify';
import { getAlerts } from '../schema/alerts';
import createOrGetConnection from '../db';
import { getSettings } from '../schema/settings';
import {
  ALERTS_DEFAULT,
  Feature,
  getUnreadNotificationsCount,
  SETTINGS_DEFAULT,
  SourceMember,
  SquadSource,
} from '../entity';
import { DataSource } from 'typeorm';
import { getSourceLink } from '../common';
import { GQLSource } from '../schema/sources';
import { IFlags } from 'flagsmith-nodejs';
import { getRedisObject } from '../redis';
import { REDIS_CHANGELOG_KEY } from '../config';

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

const getFeatures = async (
  con: DataSource,
  userId: string,
): Promise<IFlags> => {
  const features = await con.getRepository(Feature).findBy({ userId });
  return features.reduce((prev, { feature }) => {
    prev[feature] = { enabled: true };
    return prev;
  }, {});
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

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req, res) => {
    const con = await createOrGetConnection();
    const { userId } = req;
    if (userId) {
      const [
        alerts,
        settings,
        unreadNotificationsCount,
        squads,
        features,
        lastChangelog,
      ] = await Promise.all([
        getAlerts(con, userId),
        getSettings(con, userId),
        getUnreadNotificationsCount(con, userId),
        getSquads(con, userId),
        getFeatures(con, userId),
        getRedisObject(REDIS_CHANGELOG_KEY),
      ]);
      return res.send({
        alerts: excludeProperties(alerts, ['userId']),
        settings: excludeProperties(settings, [
          'userId',
          'updatedAt',
          'bookmarkSlug',
        ]),
        notifications: { unreadNotificationsCount },
        squads,
        features,
        changelog: alerts.lastChangelog < new Date(lastChangelog),
      });
    }
    return res.send({
      alerts: ALERTS_DEFAULT,
      settings: SETTINGS_DEFAULT,
      notifications: { unreadNotificationsCount: 0 },
      squads: [],
      features: {},
      changelog: false,
    });
  });
}

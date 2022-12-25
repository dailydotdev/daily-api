import { FastifyInstance } from 'fastify';
import { getAlerts } from '../schema/alerts';
import createOrGetConnection from '../db';
import { getSettings } from '../schema/settings';
import {
  ALERTS_DEFAULT,
  getUnreadNotificationsCount,
  SETTINGS_DEFAULT,
} from '../entity';

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

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req, res) => {
    const con = await createOrGetConnection();
    const { userId } = req;
    if (userId) {
      const [alerts, settings, unreadNotificationsCount] = await Promise.all([
        getAlerts(con, userId),
        getSettings(con, userId),
        getUnreadNotificationsCount(con, userId),
      ]);
      return res.send({
        alerts: excludeProperties(alerts, ['userId']),
        settings: excludeProperties(settings, [
          'userId',
          'updatedAt',
          'bookmarkSlug',
        ]),
        notifications: { unreadNotificationsCount },
      });
    }
    return res.send({
      alerts: ALERTS_DEFAULT,
      settings: SETTINGS_DEFAULT,
      notifications: { unreadNotificationsCount: 0 },
    });
  });
}

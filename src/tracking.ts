import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import isbot from 'isbot';
import { cookies, setCookie } from './cookies';
import { generateTrackingId } from './ids';

const isBotRequest = (req: FastifyRequest): boolean =>
  !req.headers['user-agent'] || isbot(req.headers['user-agent']);

export const generateSessionId = async (
  req: FastifyRequest,
  res: FastifyReply,
): Promise<string> => {
  if (!req.isBot && !req.service) {
    if (!req.sessionId?.length) {
      req.sessionId = await generateTrackingId();
    }
    // Refresh session cookie
    setCookie(req, res, 'session', req.sessionId);
  }
  return req.sessionId;
};

export const setTrackingId = (
  req: FastifyRequest,
  res: FastifyReply,
  id: string,
): FastifyReply => setCookie(req, res, 'tracking', id);

const plugin = async (fastify: FastifyInstance): Promise<void> => {
  fastify.decorateRequest('sessionId', null);
  fastify.decorateRequest('trackingId', null);
  fastify.decorateRequest('isBot', null);

  fastify.addHook('preHandler', async (req, res) => {
    req.isBot = isBotRequest(req);
    req.sessionId = req.cookies[cookies.session.key];

    const trackingCookie = req.cookies[cookies.tracking.key];
    if (req.userId) {
      req.trackingId = req.userId;
    } else if (trackingCookie) {
      req.trackingId = trackingCookie;
    } else if (!req.isBot && !req.service) {
      req.trackingId = await generateTrackingId();
    }
    if (req.trackingId !== trackingCookie) {
      setTrackingId(req, res, req.trackingId);
    }
  });
};

export default fp(plugin, {
  name: 'tracking',
});

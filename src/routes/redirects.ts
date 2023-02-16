import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import uaParser from 'ua-parser-js';
import { URL } from 'node:url';
import { isBotRequest } from '../tracking';
import { DataSource } from 'typeorm';
import { getBootData } from './newBoot';
import createOrGetConnection from '../db';

const generateEventId = (now) => {
  const randomStr = (Math.random() + 1).toString(36).substring(8);
  const timePart = (now.getTime() / 1000).toFixed(0);
  return `${timePart}${randomStr}`;
};

const sendAnalyticsEvent = async (
  con: DataSource,
  req: FastifyRequest,
  res: FastifyReply,
): Promise<void> => {
  try {
    const boot = await getBootData(con, req, res);
    const query = req.query as Record<string, string>;
    const queryStr = JSON.stringify(query);
    const now = new Date();
    const events = [
      {
        event_timestamp: now,
        event_id: generateEventId(now),
        event_name: 'page view',
        event_page: '/get',
        app_platform: 'redirector',
        query_params: queryStr.length > 2 ? queryStr : undefined,
        session_id: boot.visit.sessionId,
        user_id: boot.user.id,
        visit_id: boot.visit.visitId,
        utm_campaign: query?.utm_campaign,
        utm_content: query?.utm_content,
        utm_medium: query?.utm_medium,
        utm_source: query?.utm_source,
        utm_term: query?.utm_term,
        page_referrer: req.headers.referer,
      },
    ];
    await fetch(`${process.env.ANALYTICS_URL}/e`, {
      method: 'POST',
      body: JSON.stringify({ events }),
      headers: {
        'content-type': 'application/json',
      },
    });
  } catch (err) {
    req.log.error({ err }, 'failed to send analytics event');
  }
};

const redirectToStore =
  (con: DataSource) =>
  async (req: FastifyRequest, res: FastifyReply): Promise<FastifyReply> => {
    res.status(307);
    if (isBotRequest(req)) {
      return res.redirect('https://daily.dev');
    }

    const ua = uaParser(req.headers['user-agent']);
    const browser = ua.browser.name.toLowerCase();
    const url = new URL(req.raw.url, 'http://localhost');
    await sendAnalyticsEvent(con, req, res);
    if (browser.includes('firefox') || browser.includes('mozilla')) {
      return res.redirect(
        `https://addons.mozilla.org/en-US/firefox/addon/daily/${url.search}`,
      );
    } else if (browser.includes('edge')) {
      return res.redirect(
        `https://microsoftedge.microsoft.com/addons/detail/daily-20-source-for-bu/cbdhgldgiancdheindpekpcbkccpjaeb${url.search}`,
      );
    } else {
      return res.redirect(
        `https://chrome.google.com/webstore/detail/daily-discover-web-techno/jlmpjdjjbgclbocgajdjefcidcncaied${url.search}`,
      );
    }
  };

const redirectToLanding = (
  req: FastifyRequest,
  res: FastifyReply,
): FastifyReply => res.redirect('https://daily.dev');

export default async function (fastify: FastifyInstance): Promise<void> {
  const con = await createOrGetConnection();

  fastify.get('/', redirectToLanding);
  fastify.get('/landing', redirectToLanding);
  fastify.get('/tos', (req, res) => res.redirect('https://daily.dev/tos'));
  fastify.get('/privacy', (req, res) =>
    res.redirect('https://daily.dev/privacy'),
  );
  fastify.get('/download', redirectToStore(con));
  fastify.get('/get', redirectToStore(con));
}

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { UAParser as uaParser } from 'ua-parser-js';
import { URL } from 'node:url';
import { DataSource } from 'typeorm';
import { getBootData } from './boot';
import createOrGetConnection from '../db';
import { sendAnalyticsEvent } from '../integrations/analytics';
import { User } from '../entity';
import { fallbackImages } from '../config';

const sendRedirectAnalytics = async (
  con: DataSource,
  req: FastifyRequest,
  res: FastifyReply,
  page = '/get',
): Promise<void> => {
  try {
    const boot = await getBootData(con, req, res);
    const query = req.query as Record<string, string>;
    const queryStr = JSON.stringify(query);
    const now = new Date();
    await sendAnalyticsEvent([
      {
        event_timestamp: now,
        event_name: 'page view',
        event_page: page,
        app_platform: 'redirector',
        query_params: queryStr.length > 2 ? queryStr : undefined,
        user_id: boot.user.id!,
        utm_campaign: query?.utm_campaign,
        utm_content: query?.utm_content,
        utm_medium: query?.utm_medium,
        utm_source: query?.utm_source,
        utm_term: query?.utm_term,
        page_referrer: req.headers.referer,
      },
    ]);
  } catch (err) {
    req.log.error({ err }, 'failed to send analytics event');
  }
};

export const redirectToAndroid = ({
  req,
  res,
}: {
  req: FastifyRequest;
  res: FastifyReply;
}): FastifyReply => {
  const url = new URL(req.raw.url!, 'http://localhost');
  url.searchParams.append('id', 'dev.daily');

  return res.redirect(
    `https://play.google.com/store/apps/details${url.search}`,
  );
};

export const redirectToAppStore = ({
  req,
  res,
}: {
  req: FastifyRequest;
  res: FastifyReply;
}): FastifyReply => {
  const url = new URL(req.raw.url!, 'http://localhost');
  return res.redirect(
    `https://apps.apple.com/app/daily-dev/id6740634400${url.search}`,
  );
};

const redirectToExtensionStore = (
  req: FastifyRequest,
  res: FastifyReply,
): FastifyReply => {
  const ua = uaParser(req.headers['user-agent']);
  const browser = ua.browser.name?.toLowerCase();
  const url = new URL(req.raw.url!, 'http://localhost');
  res.status(307);

  const redirectURL = browser?.includes('edge')
    ? `https://microsoftedge.microsoft.com/addons/detail/daily-20-source-for-bu/cbdhgldgiancdheindpekpcbkccpjaeb${url.search}`
    : `https://chrome.google.com/webstore/detail/daily-discover-web-techno/jlmpjdjjbgclbocgajdjefcidcncaied${url.search}`;

  return res.status(307).redirect(redirectURL);
};

const redirectToStore =
  (con: DataSource) =>
  async (req: FastifyRequest, res: FastifyReply): Promise<FastifyReply> => {
    res.status(307);
    if (req.isBot) {
      return res.redirect('https://daily.dev');
    }

    const ua = uaParser(req.headers['user-agent']);
    const browser = ua.browser.name?.toLowerCase();
    const os = ua.os.name?.toLowerCase();
    const url = new URL(req.raw.url!, 'http://localhost');
    await sendRedirectAnalytics(con, req, res);

    if (!!req.userId) {
      return res.redirect(`https://app.daily.dev${url.search}`);
    }

    if (os?.includes('android')) {
      return redirectToAndroid({ req, res });
    }

    if (os?.includes('ios')) {
      return redirectToAppStore({ req, res });
    }

    // If mobile, tablet or any non desktop device, redirect to webapp
    if (!!ua.device.type || browser?.includes('safari')) {
      return res.redirect(`https://app.daily.dev${url.search}`);
    }

    if (browser?.includes('firefox') || browser?.includes('mozilla')) {
      return res.redirect(`https://app.daily.dev${url.search}`);
    }

    return redirectToExtensionStore(req, res);
  };

const redirectToMobile =
  (con: DataSource) =>
  async (req: FastifyRequest, res: FastifyReply): Promise<FastifyReply> => {
    res.status(307);
    if (req.isBot) {
      return res.redirect('https://app.daily.dev');
    }

    const url = new URL(req.raw.url!, 'http://localhost');
    await sendRedirectAnalytics(con, req, res, '/mobile');

    if (!!req.userId) {
      return res.redirect(`https://app.daily.dev${url.search}`);
    }

    const ua = uaParser(req.headers['user-agent']);
    const os = ua.os.name?.toLowerCase();
    if (os?.includes('android')) {
      return redirectToAndroid({ req, res });
    }

    if (os?.includes('ios')) {
      return redirectToAppStore({ req, res });
    }

    return res.redirect(`https://app.daily.dev${url.search}`);
  };

const redirectToProfileImage = async (
  con: DataSource,
  res: FastifyReply,
  id: string,
) => {
  const { image } =
    (await con.getRepository(User).findOne({
      select: ['image'],
      where: { id },
    })) || {};

  if (!image) {
    return res.redirect(fallbackImages.avatar);
  }

  return res.redirect(image);
};

export default async function (fastify: FastifyInstance): Promise<void> {
  const con = await createOrGetConnection();

  fastify.get('/', (req, res) =>
    res.redirect('https://r.daily.dev/api-redirect'),
  );
  fastify.get('/landing', (req, res) => res.redirect('https://daily.dev'));
  fastify.get('/tos', (req, res) => res.redirect('https://daily.dev/tos'));
  fastify.get('/privacy', (req, res) =>
    res.redirect('https://daily.dev/privacy'),
  );
  fastify.get('/download', redirectToStore(con));
  fastify.get('/get', redirectToStore(con));
  fastify.get('/get-extension', redirectToExtensionStore);
  fastify.get('/mobile', redirectToMobile(con));
  fastify.get<{ Params: { id: string } }>('/:id/profile-image', (req, res) =>
    redirectToProfileImage(con, res, req.params.id),
  );
}

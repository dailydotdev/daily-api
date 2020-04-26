import uuid4 from 'uuid/v4';
import Router from 'koa-router';
import validator, { object, string } from 'koa-context-validator';
import cloudinary from 'cloudinary';
import Busboy from 'busboy';
import rp from 'request-promise-native';
import { PubSub } from '@google-cloud/pubsub';
import config from '../config';
import publication from '../models/publication';
import pubsRequest from '../models/pubsRequest';
import { fetchInfo } from '../profile';
import rolesAuth from '../middlewares/rolesAuth';
import { ForbiddenError, ValidationError } from '../errors';

const pubsub = new PubSub();
const pubsubTopic = pubsub.topic('pub-request');

const notifyPubRequest = (type, req) => {
  if (config.env === 'production') {
    return pubsubTopic.publishJSON({ type, pubRequest: req });
  }

  return Promise.resolve();
};

const uploadLogo = (name, stream) =>
  new Promise((resolve, reject) => {
    const outStream = cloudinary.v2.uploader.upload_stream({
      public_id: name,
      folder: 'logos',
    }, (err) => {
      if (err) {
        reject(err);
      } else {
        // Set the transformation order hard-coded due to security reasons
        resolve(`https://res.cloudinary.com/daily-now/image/upload/t_logo,f_auto/v1/logos/${name}`);
      }
    });
    stream.pipe(outStream);
  });

const getFileStream = req => new Promise((resolve, reject) => {
  const files = [];
  const busboy = new Busboy({ headers: req.headers });
  busboy
    .on('file', (fieldname, file) => {
      files.push(file);
      if (files.length === 1) {
        resolve(file);
      }
    })
    .on('error', reject)
    .on('finish', () => {
      if (!files.length) {
        reject(new ValidationError('no files provided'));
      }
    });
  req.pipe(busboy);
});

const pubRequestExists = async (ctx, next) => {
  const model = await pubsRequest.getById(ctx.params.id);
  if (!model || model.closed || model.approved === false) {
    throw new ForbiddenError();
  }

  ctx.state.pubRequest = model;
  return next();
};

const addSuperfeedrSubscription = (rss, topic) =>
  rp({
    url: 'https://push.superfeedr.com/',
    method: 'POST',
    form: {
      'hub.mode': 'subscribe',
      'hub.topic': rss,
      'hub.callback': `${config.webhook.url}/${topic}`,
      'hub.secret': config.webhook.secret,
      format: 'json',
    },
    auth: Object.assign({}, config.superfeedr, { sendImmediately: true }),
  });

const router = Router({
  prefix: '/publications',
});

router.get(
  '/',
  async (ctx) => {
    const models = await publication.getEnabled();

    ctx.status = 200;
    ctx.body = models;
  },
);

router.post(
  ['/request', '/requests'],
  validator({
    body: object().keys({
      source: string().uri().required(),
    }),
  }, {
    stripUnknown: true,
  }),
  async (ctx) => {
    if (!ctx.state.user || !ctx.state.user.userId) {
      throw new ForbiddenError();
    }

    const { body } = ctx.request;
    const { email, name } = await fetchInfo(ctx.state.user.userId);
    const req = {
      url: body.source,
      userId: ctx.state.user.userId,
      userName: name,
      userEmail: email,
    };
    await pubsRequest.add(req);
    await notifyPubRequest('new', req);
    ctx.status = 204;
  },
);

router.get(
  '/requests/open',
  rolesAuth('moderator'),
  async (ctx) => {
    ctx.body = await pubsRequest.getOpenRequests();
    ctx.status = 200;
  },
);

router.put(
  '/requests/:id',
  rolesAuth('moderator'),
  validator({
    body: object().keys({
      url: string(),
      pubId: string().allow(null),
      pubName: string().allow(null),
      pubImage: string().allow(null),
      pubTwitter: string().allow(null),
      pubRss: string().allow(null),
    }),
  }, {
    stripUnknown: true,
  }),
  pubRequestExists,
  async (ctx) => {
    await pubsRequest.update(ctx.params.id, ctx.request.body);
    ctx.status = 204;
  },
);

router.post(
  '/requests/:id/approve',
  rolesAuth('moderator'),
  pubRequestExists,
  async (ctx) => {
    const update = { approved: true };
    await pubsRequest.update(ctx.params.id, { approved: true });
    await notifyPubRequest('approve', Object.assign({}, ctx.state.pubRequest, update));
    ctx.status = 204;
  },
);

router.post(
  '/requests/:id/decline',
  rolesAuth('moderator'),
  pubRequestExists,
  validator({
    body: object().keys({
      reason: string(),
    }),
  }, {
    stripUnknown: true,
  }),
  async (ctx) => {
    const update = { approved: false, reason: ctx.request.body.reason, closed: true };
    await pubsRequest.update(ctx.params.id, update);
    await notifyPubRequest('decline', Object.assign({}, ctx.state.pubRequest, update));
    ctx.status = 204;
  },
);

router.post(
  '/requests/:id/publish',
  rolesAuth('moderator'),
  pubRequestExists,
  async (ctx) => {
    const req = ctx.state.pubRequest;
    if (!req.pubName || !req.pubImage || !req.pubRss || !req.approved) {
      throw new ForbiddenError();
    }

    await publication.add(req.pubName, req.pubImage, true, req.pubTwitter, req.pubId);
    const update = { closed: true };
    await pubsRequest.update(ctx.params.id, update);
    if (config.env === 'production') {
      await addSuperfeedrSubscription(req.pubRss, req.pubId);
    }
    await notifyPubRequest('publish', Object.assign({}, ctx.state.pubRequest, update));
    ctx.log.info({ pubsRequest: req }, `added new publication ${req.pubId}`);
    ctx.status = 204;
  },
);

router.post(
  '/requests/:id/logo',
  rolesAuth('moderator'),
  pubRequestExists,
  async (ctx) => {
    const file = await getFileStream(ctx.req);
    const img = await uploadLogo(uuid4().replace(/-/g, ''), file);
    ctx.log.info({ pubsRequest: ctx.params.id, img }, 'uploaded image for publication request');
    await pubsRequest.update(ctx.params.id, { pubImage: img });
    ctx.body = { img };
    ctx.status = 200;
  },
);

export default router;

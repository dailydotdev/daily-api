import uuid4 from 'uuid/v4';
import Router from 'koa-router';
import validator, { object, string, boolean } from 'koa-context-validator';
import cloudinary from 'cloudinary';
import Busboy from 'busboy';
import publication from '../models/publication';
import pubsRequest from '../models/pubsRequest';
import { fetchInfo } from '../profile';
import rolesAuth from '../middlewares/rolesAuth';
import { ForbiddenError, ValidationError } from '../errors';

const uploadLogo = (name, stream) =>
  new Promise((resolve, reject) => {
    const outStream = cloudinary.v2.uploader.upload_stream({ public_id: name, folder: 'logos' }, (err, res) => {
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
    await pubsRequest.add({
      url: body.source,
      userId: ctx.state.user.userId,
      userName: name,
      userEmail: email,
    });
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
      approved: boolean(),
      reason: string(),
      pubId: string(),
      pubName: string(),
      pubImage: string(),
      pubTwitter: string(),
      pubRss: string(),
    }),
  }, {
    stripUnknown: true,
  }),
  async (ctx) => {
    await pubsRequest.update(ctx.params.id, ctx.request.body);
    ctx.status = 204;
  },
);

router.put(
  '/requests/:id/logo',
  rolesAuth('moderator'),
  async (ctx) => {
    const file = await getFileStream(ctx.req);
    const img = await uploadLogo(uuid4().replace(/-/g, ''), file);
    ctx.log.info({ pubsRequest: ctx.params.id, img }, 'uploaded image for publication request');
    await pubsRequest.update(ctx.params.id, { pubImage: img });
    ctx.status = 204;
  },
);

export default router;

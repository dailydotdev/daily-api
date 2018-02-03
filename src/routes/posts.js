import Router from 'koa-router';
import validator, { date, number, string } from 'koa-context-validator';
import post from '../models/post';
import { EntityNotFoundError, ValidationError, EntityExistError } from '../errors';
import validations from '../validations';
import adminAuth from '../middlewares/adminAuth';

const router = Router({
  prefix: '/posts',
});

router.get(
  '/latest',
  validator({
    query: {
      latest: date().iso().required(),
      page: number().min(0).required(),
      pageSize: number().positive().max(40).required(),
      pubs: string(),
    },
  }),
  async (ctx) => {
    const { query } = ctx.request;
    ctx.status = 200;
    ctx.body = await post.getLatest(query.latest, query.page, query.pageSize, query.pubs ? query.pubs.split(',') : null);
  },
);

router.get(
  '/:id',
  async (ctx) => {
    const model = await post.get(ctx.params.id);
    if (model) {
      ctx.status = 200;
      ctx.body = model;
    } else {
      throw new EntityNotFoundError('post', 'id', ctx.params.id);
    }
  },
);

router.post(
  '/',
  adminAuth,
  validator({
    body: validations.post.required(),
  }, {
    stripUnknown: true,
  }),
  async (ctx) => {
    const { body } = ctx.request;
    try {
      ctx.log.info('adding new post');
      ctx.status = 200;
      ctx.body = await post.add(
        body.id, body.title, body.url, body.publicationId,
        body.publishedAt, body.createdAt, body.image, body.ratio,
        body.placeholder,
      );
    } catch (err) {
      if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        throw new ValidationError('publicationId', ['"publicationId" fails because there is no publication with this id']);
      } else if (err.code === 'ER_DUP_ENTRY') {
        throw new EntityExistError('post', 'id', body.id);
      } else {
        throw err;
      }
    }
  },
);

export default router;

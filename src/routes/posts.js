import Router from 'koa-router';
import validator, { date, number } from 'koa-context-validator';
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
      page: number().min(0),
      pageSize: number().positive().max(40),
    },
  }),
  async (ctx) => {
    const { query } = ctx.request;
    ctx.status = 200;
    ctx.body = await post.getLatest(query.latest, query.page, query.pageSize);
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
    const requestBody = ctx.request.body;
    try {
      ctx.status = 200;
      ctx.body = await post.add(
        requestBody.id, requestBody.title, requestBody.url, requestBody.publicationId,
        requestBody.publishedAt, requestBody.image,
      );
    } catch (err) {
      if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        throw new ValidationError('publicationId', ['"publicationId" fails because there is no publication with this id']);
      } else if (err.code === 'ER_DUP_ENTRY') {
        throw new EntityExistError('post', 'id', requestBody.id);
      } else {
        throw err;
      }
    }
  },
);

export default router;

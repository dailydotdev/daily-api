import Router from 'koa-router';
import validator from 'koa-context-validator';
import source from '../models/source';
import validations from '../validations';
import { ValidationError } from '../errors';
import adminAuth from '../middlewares/adminAuth';

const router = Router({
  prefix: '/sources',
});

router.get(
  '/',
  adminAuth,
  async (ctx) => {
    ctx.status = 200;
    ctx.body = await source.getAll();
  },
);

router.post(
  '/',
  adminAuth,
  validator({
    body: validations.source.required(),
  }, {
    stripUnknown: true,
  }),
  async (ctx) => {
    const requestBody = ctx.request.body;
    try {
      ctx.status = 200;
      ctx.body = await source.add(requestBody.publicationId, requestBody.url);
    } catch (err) {
      if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        throw new ValidationError('publicationId', ['"publicationId" fails because there is no publication with this id']);
      } else {
        throw err;
      }
    }
  },
);

export default router;

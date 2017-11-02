import Router from 'koa-router';
import validator, { string } from 'koa-context-validator';

const router = Router({
  prefix: '/r',
});

router.get(
  '/',
  validator({
    query: {
      link: string().required(),
      post: string().required(),
      source: string().required(),
    },
  }),
  async (ctx) => {
    const { query } = ctx.request;
    ctx.status = 301;
    ctx.redirect(query.link);
  },
);

export default router;

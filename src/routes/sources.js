import Router from 'koa-router';
import source from '../models/source';

const router = Router({
  prefix: '/sources',
});

router.get('/', async (ctx) => {
  ctx.status = 200;
  ctx.body = await source.getAll();
});

export default router;

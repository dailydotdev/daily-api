import Router from 'koa-router';
import rp from 'request-promise-native';
import { fetchAds, fetchBSA, fetchCodeFund } from '../ads';
import config from '../config';

const router = Router({
  prefix: '/a',
});

const chooseAd = async (ctx) => {
  const ads = await fetchAds();
  const index = Math.floor(Math.random() * config.adsCount);

  if (index < ads.length) {
    return [ads[index]];
  }

  const cf = await fetchCodeFund(ctx, 'a4ace977-6531-4708-a4d9-413c8910ac2c');
  if (cf) {
    return [cf];
  }

  const bsa = await fetchBSA(ctx);
  if (bsa) {
    return [bsa];
  }

  ctx.log.info('no ads to serve');
  return [];
};

router.get('/', async (ctx) => {
  const body = await chooseAd(ctx);
  ctx.status = 200;
  ctx.body = body;
});

router.get('/:id', async (ctx) => {
  const url = `https://srv.buysellads.com/ads/${ctx.params.id}?forwardedip=${ctx.request.ip}&${ctx.request.querystring}`;
  ctx.log.info(`fetching ad from ${url}`);
  const res = await rp(url);
  ctx.status = 200;
  ctx.body = JSON.parse(res).ads;
});

export default router;

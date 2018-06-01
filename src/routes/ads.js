import Router from 'koa-router';
import rp from 'request-promise-native';
import ad from '../models/ad';
import config from '../config';

const router = Router({
  prefix: '/a',
});

const fetchBSA = async (ip) => {
  const url = `https://srv.buysellads.com/ads/CKYI623Y.json?segment=placement:dailynowco&forwardedip=${ip}`;
  const res = await rp(url);
  const ads =
    JSON.parse(res).ads.filter(a => Object.keys(a).length && Object.prototype.hasOwnProperty.call(a, 'statlink'));
  if (ads.length) {
    const selected = ads[0];
    return {
      company: selected.company,
      description: selected.description,
      image: selected.logo,
      link: `https:${selected.statlink}`,
      pixel: Object.prototype.hasOwnProperty.call(selected, 'pixel') ?
        (selected.pixel.split('||').map(pixel => pixel.replace('[timestamp]', selected.timestamp))) : [],
      backgroundColor: selected.backgroundColor,
      source: 'BSA',
    };
  }

  return null;
};

const fetchAds = async () => {
  const ads = await ad.getEnabledAds(new Date());
  const index = Math.floor(Math.random() * config.adsCount);
  if (index < ads.length) {
    const selected = ads[index];
    return {
      id: selected.id,
      description: selected.title,
      image: selected.image,
      placeholder: selected.placeholder,
      ratio: selected.ratio,
      link: selected.url,
      source: selected.source,
    };
  }

  return null;
};

router.get('/', async (ctx) => {
  const body = await Promise.all([
    fetchBSA(ctx.request.ip),
    fetchAds(),
  ]).then(([ad1, ad2]) => {
    const a = ad1 || ad2;
    return a ? [a] : [];
  });
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

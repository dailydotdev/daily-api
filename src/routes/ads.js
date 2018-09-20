import Router from 'koa-router';
import rp from 'request-promise-native';
import ad from '../models/ad';
import config from '../config';

const router = Router({
  prefix: '/a',
});

const fetchBSA = async (ctx) => {
  try {
    // eslint-disable-next-line prefer-destructuring
    const ip = ctx.request.ip;
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
  } catch (err) {
    ctx.log.warn('failed to fetch ad from BSA', { err });
  }

  return null;
};

const fetchCodeFund = async (ctx) => {
  try {
    // eslint-disable-next-line prefer-destructuring
    const ip = ctx.request.ip;
    const url = 'https://codefund.io/api/v1/impression/a4ace977-6531-4708-a4d9-413c8910ac2c';
    const res = await rp.post({
      url,
      json: true,
      body: {
        ip_address: ip,
      },
      headers: {
        'X-CodeFund-API-Key': config.codefundApiKey,
      },
    });
    const cfAd = JSON.parse(res);
    if (cfAd.house_ad) {
      return null;
    }

    const pixel = { cfAd };

    return {
      company: 'CodeFund',
      description: cfAd.description,
      image: cfAd.large_image_url,
      link: cfAd.link,
      pixel: pixel ? [pixel.startsWith('//') ? `https:${pixel}` : pixel] : [],
      source: 'CodeFund',
    };
  } catch (err) {
    ctx.log.warn('failed to fetch ad from Codefund', { err });
  }

  return null;
};

const fetchAds = async () => {
  const ads = await ad.getEnabledAds(new Date());
  return ads.map(a => ({
    id: a.id,
    description: a.title,
    image: a.image,
    placeholder: a.placeholder,
    ratio: a.ratio,
    link: a.url,
    source: a.source,
  }));
};

const chooseAd = async (ctx) => {
  const ads = await fetchAds();
  const index = Math.floor(Math.random() * config.adsCount);

  if (index < ads.length) {
    return [ads[index]];
  }

  const bsa = await fetchBSA(ctx);
  if (bsa) {
    return [bsa];
  }

  const cf = await fetchCodeFund(ctx);
  if (cf) {
    return [cf];
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

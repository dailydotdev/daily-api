import Router from 'koa-router';
import rp from 'request-promise-native';
import ad from '../models/ad';
import config from '../config';

const router = Router({
  prefix: '/a',
});

const fetchBSA = async (ctx) => {
  try {
    const { ip } = ctx.request;
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
    const { ip } = ctx.request;
    const url = 'https://codefund.io/api/v1/impression/a4ace977-6531-4708-a4d9-413c8910ac2c';
    const res = await rp({
      url,
      method: 'POST',
      json: true,
      body: {
        ip_address: ip,
        user_agent: ctx.req.headers['user-agent'],
      },
      headers: {
        'User-Agent': ctx.req.headers['user-agent'],
        'X-CodeFund-API-Key': config.codefundApiKey,
      },
    });

    if (res.house_ad || !res.link.length) {
      return null;
    }

    const { pixel } = res;

    const image = res.images.find(x => x.size_descriptor === 'wide');

    return {
      company: 'CodeFund',
      description: `${res.headline} ${res.description}`,
      image: image ? image.url : res.large_image_url,
      link: res.link,
      pixel: pixel ? [pixel.indexOf('//') === 0 ? `https:${pixel}` : pixel] : [],
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

  const cf = await fetchCodeFund(ctx);
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

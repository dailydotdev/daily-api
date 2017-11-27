import Router from 'koa-router';

const router = Router({
  prefix: '/download',
});

router.get(
  '/',
  async (ctx) => {
    ctx.status = 301;

    const browser = ctx.userAgent.browser.toLowerCase();

    if (browser === 'chrome') {
      ctx.redirect('https://chrome.google.com/webstore/detail/daily-discover-web-techno/jlmpjdjjbgclbocgajdjefcidcncaied');
    } else if (browser === 'firefox') {
      ctx.redirect('https://addons.mozilla.org/en-US/firefox/addon/daily/');
    } else {
      ctx.redirect('https://www.dailynow.co');
    }
  },
);

export default router;

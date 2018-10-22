import Router from 'koa-router';

const router = Router({
  prefix: '/download',
});

router.get(
  '/',
  async (ctx) => {
    ctx.status = 307;

    if (ctx.userAgent.isBot) {
      ctx.redirect('https://www.dailynow.co');
    } else if (ctx.userAgent.browser.toLowerCase() === 'firefox') {
      ctx.redirect('https://addons.mozilla.org/en-US/firefox/addon/daily/');
    } else {
      ctx.redirect('https://chrome.google.com/webstore/detail/daily-discover-web-techno/jlmpjdjjbgclbocgajdjefcidcncaied');
    }
  },
);

export default router;

/**
 * Used to create our first party tracking link that support universal deep links that work across ios/android.
 *
 * https://docs.customer.io/journeys/universal-links/#deep-links-vs-universal-links
 *
 * This requires marking <a class="untracked" /> in template when using this links and add link_id={% cio_link_id %}
 * cio_link_id is available in all CIO templates as global variable.
 *
 * Full exmaple:
 *  <a href="{{trigger.read_link}}&link_id={% cio_link_id %}" class="untracked" />
 *
 * &link_id is used because our deep link url always has query param ?r=
 *
 * @param {{
 *   url: string;
 * }} {
 *   url,
 * }
 * @return {*}  {string}
 */
export const createUniversalDeepLinkUrl = ({
  url,
}: {
  url: string;
}): string => {
  if (!url) {
    throw new Error('url is required');
  }

  const target = new URL(url, process.env.COMMENTS_PREFIX);

  // The redirect resolves `r` against COMMENTS_PREFIX, so only same-origin
  // (app) links can be deep linked. Reject external URLs instead of silently
  // dropping their host.
  if (target.origin !== new URL(process.env.COMMENTS_PREFIX).origin) {
    throw new Error('url must be an internal link');
  }

  const relativePath = `${target.pathname}${target.search}${target.hash}`;
  const trackingUrl = new URL('/em/t/c', process.env.COMMENTS_PREFIX);
  trackingUrl.searchParams.set('r', relativePath);
  return trackingUrl.toString();
};

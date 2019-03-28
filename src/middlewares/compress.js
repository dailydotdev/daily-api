// Taken from kompression

/**
 * Module dependencies.
 */

import compressible from 'compressible';
import isJSON from 'koa-is-json';
import status from 'statuses';
import Stream from 'stream';
import bytes from 'bytes';
import zlib from 'zlib';
import iltorb from 'iltorb';

/**
 * Encoding methods supported.
 */

const encodingMethods = {
  gzip: zlib.createGzip,
  deflate: zlib.createDeflate,
  br: iltorb.compressStream,
};

/**
 * Compress middleware.
 *
 * @param {Object} [options]
 * @return {Function}
 * @api public
 */

module.exports = (options = {}) => {
  const { filter = compressible } = options;
  let { threshold = 1024 } = options;
  if (typeof threshold === 'string') threshold = bytes(threshold);

  return async (ctx, next) => {
    ctx.vary('Accept-Encoding');

    await next();

    let { body } = ctx;
    if (!body) return;
    if (ctx.compress === false) return;
    if (ctx.request.method === 'HEAD') return;
    if (status.empty[ctx.response.status]) return;
    if (ctx.response.get('Content-Encoding')) return;

    // forced compression or implied
    if (!(ctx.compress === true || filter(ctx.response.type))) return;

    // identity
    let encoding = ctx.acceptsEncodings('br');
    if (!encoding) {
      encoding = ctx.acceptsEncodings(
        'gzip',
        'deflate',
        'identity',
      );
    }
    if (!encoding) {
      ctx.throw(406, 'supported encodings: gzip, deflate, identity, br');
    }
    if (encoding === 'identity') return;

    // json
    // eslint-disable-next-line
    if (isJSON(body)) body = ctx.body = JSON.stringify(body);

    // threshold
    if (threshold && ctx.response.length < threshold) return;

    ctx.set('Content-Encoding', encoding);
    ctx.res.removeHeader('Content-Length');

    // since brotli and zlib options are so different
    // i'm trimming down opts to just threshold
    // eslint-disable-next-line
    const stream = (ctx.body = encodingMethods[encoding](options));

    if (body instanceof Stream) {
      body.pipe(stream);
    } else {
      stream.end(body);
    }
  };
};

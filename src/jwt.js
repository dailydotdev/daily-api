import jwt from 'jsonwebtoken';
import koaJwt from 'koa-jwt';
import config from './config';

export const sign = payload =>
  new Promise((resolve, reject) => {
    const expiresIn = new Date(Date.now() + config.jwt.expiresIn);
    const newPayload = Object.assign({
      exp: expiresIn.getTime() / 1000,
    }, payload);
    jwt.sign(newPayload, config.jwt.secret, {
      audience: config.jwt.audience,
      issuer: config.jwt.issuer,
    }, (err, token) => {
      if (err) {
        return reject(err);
      }

      return resolve({
        token,
        expiresIn,
      });
    });
  });

export const verify = koaJwt({
  secret: config.jwt.secret,
  audience: config.jwt.audience,
  issuer: config.jwt.issuer,
  passthrough: true,
  getToken: ctx => ctx.request.query.access_token,
});

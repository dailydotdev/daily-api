import rp from 'request-promise-native';
import config from './config';

// eslint-disable-next-line import/prefer-default-export
export const fetchInfo = userId =>
  rp.get({
    url: `${config.gatewayUrl}/v1/users/me/info`,
    headers: { authorization: `Service ${config.gatewaySecret}`, 'user-id': userId, 'logged-in': true },
  })
    .then(res => JSON.parse(res));

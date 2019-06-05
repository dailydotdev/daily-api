import rp from 'request-promise-native';
import config from './config';

export const fetchInfo = userId =>
  rp.get({
    url: `${config.gatewayUrl}/v1/users/me/info`,
    headers: { authorization: `Service ${config.gatewaySecret}`, 'user-id': userId, 'logged-in': true },
  })
    .then(res => JSON.parse(res));

export const fetchRoles = userId =>
  rp.get({
    url: `${config.gatewayUrl}/v1/users/me/roles`,
    headers: { authorization: `Service ${config.gatewaySecret}`, 'user-id': userId, 'logged-in': true },
  })
    .then(res => JSON.parse(res));

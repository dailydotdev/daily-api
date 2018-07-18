import _ from 'lodash';
import knex from 'knex';
import config from './config';

const db = knex({
  client: 'mysql',
  connection: config.mysql,
});

export default db;

export const migrate = () => db.migrate.latest();

export const toCamelCase = obj => _.mapKeys(obj, (value, key) => _.camelCase(key));
export const toSnakeCase = obj => _.mapKeys(obj, (value, key) => _.snakeCase(key));

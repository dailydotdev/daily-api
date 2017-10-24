import config from '../config';
import { ForbiddenError } from '../errors';

const middleware = (ctx, next) => {
  if (ctx.headers.authorization === config.admin) {
    return next();
  }

  throw new ForbiddenError();
};

export default middleware;

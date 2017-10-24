import { EntityNotFoundError, ForbiddenError, ValidationError, EntityExistError } from '../errors';

const errorHandler = () =>
  async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      switch (err.name) {
        case ValidationError.name:
          ctx.status = 400;
          ctx.body = {
            code: 1,
            message: err.message,
          };
          break;
        case EntityNotFoundError.name:
          ctx.status = 404;
          ctx.body = {
            code: 2,
            message: err.message,
          };
          break;
        case ForbiddenError.name:
          ctx.status = 403;
          ctx.body = {
            code: 3,
            message: err.message,
          };
          break;
        case EntityExistError.name:
          ctx.status = 409;
          ctx.body = {
            code: 4,
            message: err.message,
          };
          break;
        default:
          ctx.status = err.status || 500;
          ctx.body = {
            message: err.message || 'Unexpected error',
          };
          break;
      }

      if (ctx.status >= 500) {
        // This is a workaround because of koa-pino-logger issues
        ctx.log.error({
          res: ctx.res,
          err: {
            type: err.constructor.name,
            message: err.message,
            stack: err.stack,
          },
          responseTime: ctx.res.responseTime,
        }, 'request errored');

        // This is how koa wiki suggests error handling, however it is not working with pino
        // ctx.app.emit('error', err, ctx);
      } else {
        ctx.log.info({
          res: ctx.res,
          err: {
            type: err.constructor.name,
            message: err.message,
            stack: err.stack,
          },
          responseTime: ctx.res.responseTime,
        }, 'request failed');
      }
    }
  };

export default errorHandler;

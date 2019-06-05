import { ForbiddenError } from '../errors';
import { fetchRoles } from '../profile';

const middleware = role => async (ctx, next) => {
  if (ctx.state.user && ctx.state.user.userId) {
    const roles = await fetchRoles(ctx.state.user.userId);
    if (roles.indexOf(role) > -1) {
      ctx.state.user.roles = roles;
      return next();
    }
  }

  throw new ForbiddenError();
};

export default middleware;

export const createAuthMiddleware = (
  fn: (ctx: Record<string, unknown>) => unknown,
) => fn;

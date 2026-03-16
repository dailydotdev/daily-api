export const betterAuth = () => ({
  handler: async () => new Response('{}', { status: 200 }),
  api: {
    getSession: async () => null,
  },
});

export type BetterAuthOptions = Record<string, unknown>;

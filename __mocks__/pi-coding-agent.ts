export const AuthStorage = {
  create: () => ({ setRuntimeApiKey: () => undefined }),
};

export const ModelRegistry = {
  inMemory: () => ({
    find: () => undefined,
    getAvailable: async () => [],
  }),
};

export class DefaultResourceLoader {
  reload = async () => undefined;
}

export const SessionManager = {
  inMemory: () => ({}),
};

export const createAgentSession = async () => ({
  session: {
    prompt: async () => undefined,
    dispose: () => undefined,
  },
});

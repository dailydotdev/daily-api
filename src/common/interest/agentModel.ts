import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuthStorage, ModelRegistry } from '@earendil-works/pi-coding-agent';

export const MODEL_PROVIDER = 'anthropic';

export const createInterestAgentModel = async () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not configured for the interest agent',
    );
  }

  const modelId = process.env.INTEREST_AGENT_MODEL || 'claude-opus-4-8';
  const agentDir = await mkdtemp(join(tmpdir(), 'interest-agent-'));

  const authStorage = AuthStorage.create(join(agentDir, 'auth.json'));
  authStorage.setRuntimeApiKey(MODEL_PROVIDER, apiKey);
  const modelRegistry = ModelRegistry.inMemory(authStorage);
  const model =
    modelRegistry.find(MODEL_PROVIDER, modelId) ??
    modelRegistry
      .getAvailable()
      .find((candidate) => candidate.provider === MODEL_PROVIDER);
  if (!model) {
    throw new Error(
      `interest agent model not found: ${MODEL_PROVIDER}/${modelId}`,
    );
  }

  return { agentDir, authStorage, modelRegistry, model };
};

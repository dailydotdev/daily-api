import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  setRedisObjectWithExpiry,
  getRedisObject,
  redisPubSub,
} from '../../redis';

interface AgentStatusMessage {
  name: string;
  project: string;
  status: string;
  task: string;
  message?: string;
  timestamp: string;
}

interface StatusBody {
  agents: AgentStatusMessage[];
}

const REDIS_KEY_PREFIX = 'agent-status';
const STATUS_TTL_SECONDS = 120;

export const getAgentStatusFromRedis = async (
  userId: string,
): Promise<AgentStatusMessage[]> => {
  const redisKey = `${REDIS_KEY_PREFIX}:${userId}`;
  const data = await getRedisObject(redisKey);
  if (!data) {
    return [];
  }
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export default async function (fastify: FastifyInstance): Promise<void> {
  // POST /agent-status — push status update from hook
  fastify.post<{ Body: StatusBody }>(
    '/',
    {
      schema: {
        description:
          'Push agent status updates. Used by CLI hooks to report coding agent activity.',
        tags: ['agent-status'],
        body: {
          type: 'object',
          required: ['agents'],
          properties: {
            agents: {
              type: 'array',
              items: {
                type: 'object',
                required: ['name', 'project', 'status', 'task', 'timestamp'],
                properties: {
                  name: { type: 'string' },
                  project: { type: 'string' },
                  status: {
                    type: 'string',
                    enum: [
                      'working',
                      'waiting',
                      'error',
                      'completed',
                      'idle',
                    ],
                  },
                  task: { type: 'string' },
                  message: { type: 'string' },
                  timestamp: { type: 'string' },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
            },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Body: StatusBody }>, res) => {
      // userId is guaranteed by the public API auth hook
      const { agents } = req.body;
      const redisKey = `${REDIS_KEY_PREFIX}:${req.userId}`;
      const payload = JSON.stringify(agents);

      await setRedisObjectWithExpiry(redisKey, payload, STATUS_TTL_SECONDS);
      await redisPubSub.publish(`events.agent-status.${req.userId}`, agents);

      return res.status(200).send({ status: 'ok' });
    },
  );

  // GET /agent-status — read current status
  fastify.get(
    '/',
    {
      schema: {
        description: 'Get current agent status for the authenticated user.',
        tags: ['agent-status'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                project: { type: 'string' },
                status: { type: 'string' },
                task: { type: 'string' },
                message: { type: 'string' },
                timestamp: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (req, res) => {
      // userId is guaranteed by the public API auth hook
      const agents = await getAgentStatusFromRedis(req.userId!);
      return res.status(200).send(agents);
    },
  );
}

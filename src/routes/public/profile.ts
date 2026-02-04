import type { FastifyInstance } from 'fastify';
import { executeGraphql } from './graphqlExecutor';
import { ensureDbConnection, PROFILE_FIELDS, ProfileType } from './common';

// GraphQL queries
const WHOAMI_QUERY = `
  query PublicApiWhoami {
    whoami {
      ${PROFILE_FIELDS}
    }
  }
`;

// GraphQL mutations
const UPDATE_USER_INFO_MUTATION = `
  mutation PublicApiUpdateUserInfo($data: UpdateUserInfoInput!) {
    updateUserInfo(data: $data) {
      ${PROFILE_FIELDS}
    }
  }
`;

// Response types
interface WhoamiResponse {
  whoami: ProfileType;
}

interface UpdateUserInfoResponse {
  updateUserInfo: ProfileType;
}

export default async function (fastify: FastifyInstance): Promise<void> {
  // Get current user's profile
  fastify.get(
    '/',
    {
      schema: {
        description: "Get current user's profile",
        tags: ['profile'],
        response: {
          200: { $ref: 'Profile#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: WHOAMI_QUERY,
          variables: {},
        },
        (json) => {
          const result = json as unknown as WhoamiResponse;
          return result.whoami;
        },
        request,
        reply,
      );
    },
  );

  // Update user profile
  fastify.patch<{
    Body: {
      name?: string;
      bio?: string;
      readme?: string;
      company?: string;
      title?: string;
      timezone?: string;
      weekStart?: number;
      acceptedMarketing?: boolean;
      experienceLevel?: string;
      socialLinks?: Array<{ url: string; platform?: string }>;
    };
  }>(
    '/',
    {
      schema: {
        description: 'Update user profile',
        tags: ['profile'],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Full name' },
            bio: { type: 'string', description: 'Short bio' },
            readme: {
              type: 'string',
              description: 'Profile readme (markdown)',
            },
            company: { type: 'string', description: 'Current company' },
            title: { type: 'string', description: 'Job title' },
            timezone: { type: 'string', description: 'Preferred timezone' },
            weekStart: {
              type: 'integer',
              minimum: 0,
              maximum: 6,
              description: 'Day of week to start (0=Sunday)',
            },
            acceptedMarketing: {
              type: 'boolean',
              description: 'Accept marketing emails',
            },
            experienceLevel: {
              type: 'string',
              description: 'Experience level',
            },
            socialLinks: {
              type: 'array',
              items: {
                type: 'object',
                required: ['url'],
                properties: {
                  url: {
                    type: 'string',
                    format: 'uri',
                    description: 'Full URL to the social profile',
                  },
                  platform: {
                    type: 'string',
                    description:
                      'Platform identifier (auto-detected if not provided)',
                  },
                },
              },
              description:
                'Social media links (replaces all existing links). Platform auto-detected from URL if not provided.',
            },
          },
        },
        response: {
          200: { $ref: 'Profile#' },
          400: { $ref: 'Error#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const con = ensureDbConnection(fastify.con);
      const {
        name,
        bio,
        readme,
        company,
        title,
        timezone,
        weekStart,
        acceptedMarketing,
        experienceLevel,
        socialLinks,
      } = request.body;

      // Build the data object, only including defined values
      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (bio !== undefined) data.bio = bio;
      if (readme !== undefined) data.readme = readme;
      if (company !== undefined) data.company = company;
      if (title !== undefined) data.title = title;
      if (timezone !== undefined) data.timezone = timezone;
      if (weekStart !== undefined) data.weekStart = weekStart;
      if (acceptedMarketing !== undefined)
        data.acceptedMarketing = acceptedMarketing;
      if (experienceLevel !== undefined) data.experienceLevel = experienceLevel;
      if (socialLinks !== undefined) data.socialLinks = socialLinks;

      return executeGraphql(
        con,
        {
          query: UPDATE_USER_INFO_MUTATION,
          variables: { data },
        },
        (json) => {
          const result = json as unknown as UpdateUserInfoResponse;
          return result.updateUserInfo;
        },
        request,
        reply,
      );
    },
  );
}

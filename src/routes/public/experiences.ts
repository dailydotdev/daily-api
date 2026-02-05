import type { FastifyInstance } from 'fastify';
import { executeGraphql } from './graphqlExecutor';
import {
  parseLimit,
  ensureDbConnection,
  USER_EXPERIENCE_FIELDS,
  PAGE_INFO_FIELDS,
  UserExperienceType,
  UserExperienceConnection,
} from './common';

// GraphQL queries
const USER_EXPERIENCES_QUERY = `
  query PublicApiUserExperiences($userId: ID!, $type: UserExperienceType, $first: Int, $after: String) {
    userExperiences(userId: $userId, type: $type, first: $first, after: $after) {
      edges {
        node {
          ${USER_EXPERIENCE_FIELDS}
        }
      }
      ${PAGE_INFO_FIELDS}
    }
  }
`;

const USER_EXPERIENCE_BY_ID_QUERY = `
  query PublicApiUserExperienceById($id: ID!) {
    userExperienceById(id: $id) {
      ${USER_EXPERIENCE_FIELDS}
    }
  }
`;

// GraphQL mutations
const UPSERT_USER_GENERAL_EXPERIENCE_MUTATION = `
  mutation PublicApiUpsertUserGeneralExperience($input: UserGeneralExperienceInput!, $id: ID) {
    upsertUserGeneralExperience(input: $input, id: $id) {
      ${USER_EXPERIENCE_FIELDS}
    }
  }
`;

const UPSERT_USER_WORK_EXPERIENCE_MUTATION = `
  mutation PublicApiUpsertUserWorkExperience($input: UserExperienceWorkInput!, $id: ID) {
    upsertUserWorkExperience(input: $input, id: $id) {
      ${USER_EXPERIENCE_FIELDS}
    }
  }
`;

const REMOVE_USER_EXPERIENCE_MUTATION = `
  mutation PublicApiRemoveUserExperience($id: ID!) {
    removeUserExperience(id: $id) {
      _
    }
  }
`;

// Response types
interface UserExperiencesResponse {
  userExperiences: UserExperienceConnection;
}

interface UserExperienceByIdResponse {
  userExperienceById: UserExperienceType | null;
}

interface UpsertUserGeneralExperienceResponse {
  upsertUserGeneralExperience: UserExperienceType;
}

interface UpsertUserWorkExperienceResponse {
  upsertUserWorkExperience: UserExperienceType;
}

// Experience types enum for validation
const EXPERIENCE_TYPES = [
  'work',
  'education',
  'project',
  'certification',
  'volunteering',
  'opensource',
] as const;

type ExperienceTypeValue = (typeof EXPERIENCE_TYPES)[number];

// Work experience has additional fields
const isWorkExperience = (type: string): boolean => type === 'work';

export default async function (fastify: FastifyInstance): Promise<void> {
  // List user's experiences
  fastify.get<{
    Querystring: { type?: string; limit?: string; cursor?: string };
  }>(
    '/',
    {
      schema: {
        description: "Get current user's experiences (work, education, etc.)",
        tags: ['experiences'],
        querystring: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: EXPERIENCE_TYPES as unknown as string[],
              description: 'Filter by experience type',
            },
            limit: {
              type: 'integer',
              default: 20,
              maximum: 50,
              minimum: 1,
              description: 'Number of items to return (1-50)',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor from previous response',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: 'UserExperience#' } },
              pagination: { $ref: 'Pagination#' },
            },
          },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const limit = parseLimit(request.query.limit);
      const { cursor, type } = request.query;
      const con = ensureDbConnection(fastify.con);
      const userId = request.userId;

      if (!userId) {
        return reply.status(401).send({
          error: 'unauthorized',
          message: 'Authentication required',
        });
      }

      return executeGraphql(
        con,
        {
          query: USER_EXPERIENCES_QUERY,
          variables: {
            userId,
            type: type || null,
            first: limit,
            after: cursor ?? null,
          },
        },
        (json) => {
          const result = json as unknown as UserExperiencesResponse;
          return {
            data: result.userExperiences.edges.map(({ node }) => node),
            pagination: {
              hasNextPage: result.userExperiences.pageInfo.hasNextPage,
              cursor: result.userExperiences.pageInfo.endCursor,
            },
          };
        },
        request,
        reply,
      );
    },
  );

  // Get single experience by ID
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        description: 'Get a specific experience by ID',
        tags: ['experiences'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Experience ID' },
          },
          required: ['id'],
        },
        response: {
          200: { $ref: 'UserExperience#' },
          401: { $ref: 'Error#' },
          404: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: USER_EXPERIENCE_BY_ID_QUERY,
          variables: { id },
        },
        (json) => {
          const result = json as unknown as UserExperienceByIdResponse;
          if (!result.userExperienceById) {
            return reply.status(404).send({
              error: 'not_found',
              message: 'Experience not found',
            });
          }
          return result.userExperienceById;
        },
        request,
        reply,
      );
    },
  );

  // Create experience
  fastify.post<{
    Body: {
      type: ExperienceTypeValue;
      title: string;
      subtitle?: string;
      description?: string;
      startedAt: string;
      endedAt?: string;
      companyId?: string;
      customCompanyName?: string;
      url?: string;
      grade?: string;
      externalReferenceId?: string;
      customDomain?: string;
      repository?: {
        id?: string;
        owner?: string;
        name: string;
        url: string;
        image?: string;
      };
      // Work-specific fields
      externalLocationId?: string;
      locationType?: string;
      employmentType?: string;
      skills?: string[];
    };
  }>(
    '/',
    {
      schema: {
        description: 'Create a new experience',
        tags: ['experiences'],
        body: {
          type: 'object',
          required: ['type', 'title', 'startedAt'],
          properties: {
            type: {
              type: 'string',
              enum: EXPERIENCE_TYPES as unknown as string[],
              description: 'Experience type',
            },
            title: { type: 'string', description: 'Job title or degree name' },
            subtitle: {
              type: 'string',
              description: 'Subtitle (e.g., field of study)',
            },
            description: { type: 'string', description: 'Description' },
            startedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Start date',
            },
            endedAt: {
              type: 'string',
              format: 'date-time',
              description: 'End date (null if current)',
            },
            companyId: {
              type: 'string',
              description: 'Company ID from our database',
            },
            customCompanyName: {
              type: 'string',
              description:
                'Custom company/organization name if not in database',
            },
            url: {
              type: 'string',
              format: 'uri',
              description: 'URL for project/certification',
            },
            grade: {
              type: 'string',
              description: 'Grade (for education)',
            },
            externalReferenceId: {
              type: 'string',
              description: 'External reference ID',
            },
            customDomain: {
              type: 'string',
              description: 'Custom domain for favicon',
            },
            repository: {
              type: 'object',
              description: 'Repository info (for opensource type)',
              properties: {
                id: { type: 'string' },
                owner: { type: 'string' },
                name: { type: 'string' },
                url: { type: 'string', format: 'uri' },
                image: { type: 'string', format: 'uri' },
              },
              required: ['name', 'url'],
            },
            // Work-specific fields
            externalLocationId: {
              type: 'string',
              description: 'External location ID (work only)',
            },
            locationType: {
              type: 'string',
              description: 'Location type: ONSITE, REMOTE, HYBRID (work only)',
            },
            employmentType: {
              type: 'string',
              description:
                'Employment type: FULL_TIME, PART_TIME, CONTRACT, etc. (work only)',
            },
            skills: {
              type: 'array',
              items: { type: 'string' },
              description: 'Skills used (work only)',
            },
          },
        },
        response: {
          200: { $ref: 'UserExperience#' },
          400: { $ref: 'Error#' },
          401: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const con = ensureDbConnection(fastify.con);
      const body = request.body;

      if (isWorkExperience(body.type)) {
        // Use work experience mutation
        const input: Record<string, unknown> = {
          type: body.type,
          title: body.title,
          startedAt: body.startedAt,
        };
        if (body.subtitle !== undefined) input.subtitle = body.subtitle;
        if (body.description !== undefined)
          input.description = body.description;
        if (body.endedAt !== undefined) input.endedAt = body.endedAt;
        if (body.companyId !== undefined) input.companyId = body.companyId;
        if (body.customCompanyName !== undefined)
          input.customCompanyName = body.customCompanyName;
        if (body.customDomain !== undefined)
          input.customDomain = body.customDomain;
        if (body.externalLocationId !== undefined)
          input.externalLocationId = body.externalLocationId;
        if (body.locationType !== undefined)
          input.locationType = body.locationType;
        if (body.employmentType !== undefined)
          input.employmentType = body.employmentType;
        if (body.skills !== undefined) input.skills = body.skills;

        return executeGraphql(
          con,
          {
            query: UPSERT_USER_WORK_EXPERIENCE_MUTATION,
            variables: { input },
          },
          (json) => {
            const result = json as unknown as UpsertUserWorkExperienceResponse;
            return result.upsertUserWorkExperience;
          },
          request,
          reply,
        );
      } else {
        // Use general experience mutation
        const input: Record<string, unknown> = {
          type: body.type,
          title: body.title,
          startedAt: body.startedAt,
        };
        if (body.subtitle !== undefined) input.subtitle = body.subtitle;
        if (body.description !== undefined)
          input.description = body.description;
        if (body.endedAt !== undefined) input.endedAt = body.endedAt;
        if (body.companyId !== undefined) input.companyId = body.companyId;
        if (body.customCompanyName !== undefined)
          input.customCompanyName = body.customCompanyName;
        if (body.url !== undefined) input.url = body.url;
        if (body.grade !== undefined) input.grade = body.grade;
        if (body.externalReferenceId !== undefined)
          input.externalReferenceId = body.externalReferenceId;
        if (body.customDomain !== undefined)
          input.customDomain = body.customDomain;
        if (body.repository !== undefined) input.repository = body.repository;

        return executeGraphql(
          con,
          {
            query: UPSERT_USER_GENERAL_EXPERIENCE_MUTATION,
            variables: { input },
          },
          (json) => {
            const result =
              json as unknown as UpsertUserGeneralExperienceResponse;
            return result.upsertUserGeneralExperience;
          },
          request,
          reply,
        );
      }
    },
  );

  // Update experience
  fastify.put<{
    Params: { id: string };
    Body: {
      type: ExperienceTypeValue;
      title: string;
      subtitle?: string;
      description?: string;
      startedAt: string;
      endedAt?: string;
      companyId?: string;
      customCompanyName?: string;
      url?: string;
      grade?: string;
      externalReferenceId?: string;
      customDomain?: string;
      repository?: {
        id?: string;
        owner?: string;
        name: string;
        url: string;
        image?: string;
      };
      // Work-specific fields
      externalLocationId?: string;
      locationType?: string;
      employmentType?: string;
      skills?: string[];
    };
  }>(
    '/:id',
    {
      schema: {
        description: 'Update an existing experience',
        tags: ['experiences'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Experience ID' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['type', 'title', 'startedAt'],
          properties: {
            type: {
              type: 'string',
              enum: EXPERIENCE_TYPES as unknown as string[],
              description: 'Experience type',
            },
            title: { type: 'string', description: 'Job title or degree name' },
            subtitle: {
              type: 'string',
              description: 'Subtitle (e.g., field of study)',
            },
            description: { type: 'string', description: 'Description' },
            startedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Start date',
            },
            endedAt: {
              type: 'string',
              format: 'date-time',
              description: 'End date (null if current)',
            },
            companyId: {
              type: 'string',
              description: 'Company ID from our database',
            },
            customCompanyName: {
              type: 'string',
              description:
                'Custom company/organization name if not in database',
            },
            url: {
              type: 'string',
              format: 'uri',
              description: 'URL for project/certification',
            },
            grade: {
              type: 'string',
              description: 'Grade (for education)',
            },
            externalReferenceId: {
              type: 'string',
              description: 'External reference ID',
            },
            customDomain: {
              type: 'string',
              description: 'Custom domain for favicon',
            },
            repository: {
              type: 'object',
              description: 'Repository info (for opensource type)',
              properties: {
                id: { type: 'string' },
                owner: { type: 'string' },
                name: { type: 'string' },
                url: { type: 'string', format: 'uri' },
                image: { type: 'string', format: 'uri' },
              },
              required: ['name', 'url'],
            },
            // Work-specific fields
            externalLocationId: {
              type: 'string',
              description: 'External location ID (work only)',
            },
            locationType: {
              type: 'string',
              description: 'Location type: ONSITE, REMOTE, HYBRID (work only)',
            },
            employmentType: {
              type: 'string',
              description:
                'Employment type: FULL_TIME, PART_TIME, CONTRACT, etc. (work only)',
            },
            skills: {
              type: 'array',
              items: { type: 'string' },
              description: 'Skills used (work only)',
            },
          },
        },
        response: {
          200: { $ref: 'UserExperience#' },
          400: { $ref: 'Error#' },
          401: { $ref: 'Error#' },
          404: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const con = ensureDbConnection(fastify.con);
      const body = request.body;

      if (isWorkExperience(body.type)) {
        // Use work experience mutation
        const input: Record<string, unknown> = {
          type: body.type,
          title: body.title,
          startedAt: body.startedAt,
        };
        if (body.subtitle !== undefined) input.subtitle = body.subtitle;
        if (body.description !== undefined)
          input.description = body.description;
        if (body.endedAt !== undefined) input.endedAt = body.endedAt;
        if (body.companyId !== undefined) input.companyId = body.companyId;
        if (body.customCompanyName !== undefined)
          input.customCompanyName = body.customCompanyName;
        if (body.customDomain !== undefined)
          input.customDomain = body.customDomain;
        if (body.externalLocationId !== undefined)
          input.externalLocationId = body.externalLocationId;
        if (body.locationType !== undefined)
          input.locationType = body.locationType;
        if (body.employmentType !== undefined)
          input.employmentType = body.employmentType;
        if (body.skills !== undefined) input.skills = body.skills;

        return executeGraphql(
          con,
          {
            query: UPSERT_USER_WORK_EXPERIENCE_MUTATION,
            variables: { input, id },
          },
          (json) => {
            const result = json as unknown as UpsertUserWorkExperienceResponse;
            return result.upsertUserWorkExperience;
          },
          request,
          reply,
        );
      } else {
        // Use general experience mutation
        const input: Record<string, unknown> = {
          type: body.type,
          title: body.title,
          startedAt: body.startedAt,
        };
        if (body.subtitle !== undefined) input.subtitle = body.subtitle;
        if (body.description !== undefined)
          input.description = body.description;
        if (body.endedAt !== undefined) input.endedAt = body.endedAt;
        if (body.companyId !== undefined) input.companyId = body.companyId;
        if (body.customCompanyName !== undefined)
          input.customCompanyName = body.customCompanyName;
        if (body.url !== undefined) input.url = body.url;
        if (body.grade !== undefined) input.grade = body.grade;
        if (body.externalReferenceId !== undefined)
          input.externalReferenceId = body.externalReferenceId;
        if (body.customDomain !== undefined)
          input.customDomain = body.customDomain;
        if (body.repository !== undefined) input.repository = body.repository;

        return executeGraphql(
          con,
          {
            query: UPSERT_USER_GENERAL_EXPERIENCE_MUTATION,
            variables: { input, id },
          },
          (json) => {
            const result =
              json as unknown as UpsertUserGeneralExperienceResponse;
            return result.upsertUserGeneralExperience;
          },
          request,
          reply,
        );
      }
    },
  );

  // Delete experience
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        description: 'Delete an experience',
        tags: ['experiences'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Experience ID' },
          },
          required: ['id'],
        },
        response: {
          200: { $ref: 'SuccessResponse#' },
          401: { $ref: 'Error#' },
          404: { $ref: 'Error#' },
          429: { $ref: 'RateLimitError#' },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const con = ensureDbConnection(fastify.con);

      return executeGraphql(
        con,
        {
          query: REMOVE_USER_EXPERIENCE_MUTATION,
          variables: { id },
        },
        () => ({ success: true }),
        request,
        reply,
      );
    },
  );
}

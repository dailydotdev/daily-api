import { GraphQLResponse } from 'apollo-server-types';
import { FastifyInstance } from 'fastify';
import request from 'supertest';
import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import {
  authorizeRequest,
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  Mutation,
  testMutationError,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import { Roles } from '../src/roles';
import { Source, SourceRequest, User } from '../src/entity';
import { sourceRequestFixture } from './fixture/sourceRequest';
import { uploadLogo } from '../src/common';
import {
  GQLDeclineSourceRequestInput,
  GQLRequestSourceInput,
  GQLUpdateSourceRequestInput,
} from '../src/schema/sourceRequests';
import { usersFixture } from './fixture/user';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';

let app: FastifyInstance;
let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;
let roles: Roles[] = [];

jest.mock('../src/common', () => ({
  ...(jest.requireActual('../src/common') as Record<string, unknown>),
  uploadLogo: jest.fn(),
}));

const testModeratorAuthorization = (mutation: Mutation): Promise<void> => {
  roles = [];
  loggedUser = '1';
  return testMutationErrorCode(client, mutation, 'FORBIDDEN');
};

const testNotFound = (mutation: Mutation): Promise<void> => {
  roles = [Roles.Moderator];
  loggedUser = '1';
  return testMutationErrorCode(client, mutation, 'NOT_FOUND');
};

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser, false, roles),
  );
  client = state.client;
  app = state.app;
});

beforeEach(async () => {
  loggedUser = null;
  roles = [];
});

afterAll(() => disposeGraphQLTesting(state));

describe('mutation requestSource', () => {
  const MUTATION = `
  mutation RequestSource($data: RequestSourceInput!) {
  requestSource(data: $data) {
    sourceUrl
    userId
    userName
    userEmail
  }
}`;

  const userWithReputation = {
    ...usersFixture[0],
    reputation: 250,
  };

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { data: { sourceUrl: 'http://source.com' } },
      },
      'UNAUTHENTICATED',
    ));

  it('should return bad request when url is not valid', async () => {
    loggedUser = '1';
    return testMutationError(
      client,
      {
        mutation: MUTATION,
        variables: { data: { sourceUrl: 'invalid' } },
      },
      (errors) => expect(errors).toMatchSnapshot(),
    );
  });

  it('should add new source request', async () => {
    await con.getRepository(User).save([userWithReputation]);
    loggedUser = '1';
    const data: GQLRequestSourceInput = { sourceUrl: 'http://source.com' };
    const res = await client.mutate(MUTATION, { variables: { data } });
    expect(res.data).toMatchSnapshot();
  });

  it('should throw forbidden error when user reputation is below threshold', async () => {
    await con.getRepository(User).save([
      {
        ...userWithReputation,
        reputation: 10,
      },
    ]);
    loggedUser = '1';
    const data: GQLRequestSourceInput = { sourceUrl: 'http://source.com' };
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { data },
      },
      'FORBIDDEN',
    );
  });
});

describe('mutation updateSourceRequest', () => {
  const MUTATION = (id: string): string => `
  mutation UpdateSourceRequest($data: UpdateSourceRequestInput!) {
  updateSourceRequest(id: "${id}", data: $data) {
    sourceUrl
    sourceId
    sourceName
    sourceImage
    sourceTwitter
    sourceFeed
  }
}`;

  it('should not authorize when not moderator', () =>
    testModeratorAuthorization({
      mutation: MUTATION('1'),
      variables: { data: { sourceUrl: 'http://new.com' } },
    }));

  it('should throw not found when source request does not exist', () =>
    testNotFound({
      mutation: MUTATION(uuidv4()),
      variables: { data: { sourceUrl: 'http://new.com' } },
    }));

  it('should partially update existing request', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    const req = await con
      .getRepository(SourceRequest)
      .save(sourceRequestFixture[2]);
    const data: GQLUpdateSourceRequestInput = {
      sourceUrl: 'http://source.com',
      sourceImage: 'http://image.com',
    };
    const res = await client.mutate(MUTATION(req.id), { variables: { data } });
    expect(res.data).toMatchSnapshot();
  });
});

describe('mutation declineSourceRequest', () => {
  const MUTATION = (id: string): string => `
  mutation DeclineSourceRequest($data: DeclineSourceRequestInput!) {
  declineSourceRequest(id: "${id}", data: $data) {
    approved
    closed
    reason
  }
}`;

  it('should not authorize when not moderator', () =>
    testModeratorAuthorization({
      mutation: MUTATION('1'),
      variables: { data: { reason: 'not-active' } },
    }));

  it('should throw not found when source request does not exist', () =>
    testNotFound({
      mutation: MUTATION(uuidv4()),
      variables: { data: { reason: 'not-active' } },
    }));

  it('should decline a source request', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    const req = await con
      .getRepository(SourceRequest)
      .save(sourceRequestFixture[2]);
    const data: GQLDeclineSourceRequestInput = { reason: 'not-active' };
    const res = await client.mutate(MUTATION(req.id), { variables: { data } });
    expect(res.data).toMatchSnapshot();
  });
});

describe('mutation approveSourceRequest', () => {
  const MUTATION = (id: string): string => `
  mutation ApproveSourceRequest {
  approveSourceRequest(id: "${id}") {
    approved
    closed
    reason
  }
}`;

  it('should not authorize when not moderator', () =>
    testModeratorAuthorization({
      mutation: MUTATION('1'),
    }));

  it('should throw not found when source request does not exist', () =>
    testNotFound({
      mutation: MUTATION(uuidv4()),
    }));

  it('should approve a source request', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    const req = await con
      .getRepository(SourceRequest)
      .save(sourceRequestFixture[2]);
    const res = await client.mutate(MUTATION(req.id));
    expect(res.data).toMatchSnapshot();
  });
});

describe('mutation uploadSourceRequestLogo', () => {
  const MUTATION = (id: string): string => `
  mutation UploadSourceRequestLogo($file: Upload!) {
  uploadSourceRequestLogo(id: "${id}", file: $file) {
    sourceImage
  }
}`;

  it('should not authorize when not moderator', async () => {
    roles = [];
    loggedUser = '1';
    const res = await authorizeRequest(
      request(app.server)
        .post('/graphql')
        .field(
          'operations',
          JSON.stringify({
            query: MUTATION('1'),
            variables: { file: null },
          }),
        )
        .field('map', JSON.stringify({ '0': ['variables.file'] }))
        .attach('0', './__tests__/fixture/happy_card.png'),
    ).expect(200);
    const body = res.body as GraphQLResponse;
    expect(body.errors.length).toEqual(1);
    expect(body.errors[0].extensions.code).toEqual('FORBIDDEN');
  });

  it('should upload new logo for source request', async () => {
    loggedUser = '1';
    roles = [Roles.Moderator];
    const req = await con
      .getRepository(SourceRequest)
      .save(sourceRequestFixture[2]);
    jest.mocked(uploadLogo).mockResolvedValue('http://image.com');
    const res = await authorizeRequest(
      request(app.server)
        .post('/graphql')
        .field(
          'operations',
          JSON.stringify({
            query: MUTATION(req.id),
            variables: { file: null },
          }),
        )
        .field('map', JSON.stringify({ '0': ['variables.file'] }))
        .attach('0', './__tests__/fixture/happy_card.png'),
      loggedUser,
      roles,
    ).expect(200);
    const body = res.body as GraphQLResponse;
    expect(body.errors).toBeFalsy();
    expect(body.data).toMatchSnapshot();
  });
});

describe('mutation publishSourceRequest', () => {
  const MUTATION = (id: string): string => `
  mutation PublishSourceRequest {
  publishSourceRequest(id: "${id}") {
    approved
    closed
  }
}`;

  it('should not authorize when not moderator', () =>
    testModeratorAuthorization({
      mutation: MUTATION('1'),
    }));

  it('should throw not found when source request does not exist', () =>
    testNotFound({
      mutation: MUTATION(uuidv4()),
    }));

  it('should publish a source request', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    const req = await con
      .getRepository(SourceRequest)
      .save(sourceRequestFixture[2]);
    const res = await client.mutate(MUTATION(req.id));
    expect(res.data).toMatchSnapshot();
    const source = await con
      .getRepository(Source)
      .findOneByOrFail({ id: req.sourceId });
    delete source.createdAt;
    expect(source).toMatchSnapshot();
    expect(await source.feeds).toMatchSnapshot();
  });
});

describe('query pendingSourceRequests', () => {
  const QUERY = (first = 10): string => `{
  pendingSourceRequests(first: ${first}) {
    pageInfo {
      endCursor
      hasNextPage
    }
    edges {
      node {
        sourceUrl
      }
    }
  }
}`;

  it('should not authorize when not moderator', async () => {
    roles = [];
    loggedUser = '1';
    return testQueryErrorCode(client, { query: QUERY() }, 'FORBIDDEN');
  });

  it('should return pending source requests', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';

    await con.getRepository(SourceRequest).save(sourceRequestFixture);

    const res = await client.query(QUERY());
    expect(res.data).toMatchSnapshot();
  });
});

describe('compatibility routes', () => {
  describe('GET /publications/requests/open', () => {
    it('should return pending source requests', async () => {
      await con.getRepository(SourceRequest).save(sourceRequestFixture);

      loggedUser = '1';
      roles = [Roles.Moderator];
      const res = await authorizeRequest(
        request(app.server).get('/v1/publications/requests/open'),
        loggedUser,
        roles,
      ).expect(200);
      const actual = res.body.map((x) => _.omit(x, ['id', 'createdAt']));
      expect(actual).toMatchSnapshot();
    });
  });

  describe('PUT /publications/requests/:id', () => {
    it('should update an existing source request', async () => {
      loggedUser = '1';
      roles = [Roles.Moderator];
      const req = await con
        .getRepository(SourceRequest)
        .save(sourceRequestFixture[2]);
      await authorizeRequest(
        request(app.server).put(`/v1/publications/requests/${req.id}`),
        loggedUser,
        roles,
      )
        .send({ url: 'http://source.com', pubImage: 'http://image.com' })
        .expect(204);
      expect(
        await con.getRepository(SourceRequest).findOne({
          where: { id: req.id },
          select: ['sourceUrl', 'sourceImage', 'sourceName', 'sourceTwitter'],
        }),
      ).toMatchSnapshot();
    });
  });

  describe('POST /publications/requests/:id/decline', () => {
    it('should decline a source request', async () => {
      loggedUser = '1';
      roles = [Roles.Moderator];
      const req = await con
        .getRepository(SourceRequest)
        .save(sourceRequestFixture[2]);
      await authorizeRequest(
        request(app.server).post(`/v1/publications/requests/${req.id}/decline`),
        loggedUser,
        roles,
      )
        .send({ reason: 'not-active' })
        .expect(204);
      expect(
        await con.getRepository(SourceRequest).findOne({
          where: { id: req.id },
          select: ['approved', 'closed', 'reason'],
        }),
      ).toMatchSnapshot();
    });
  });

  describe('POST /publications/requests/:id/approve', () => {
    it('should approve a source request', async () => {
      loggedUser = '1';
      roles = [Roles.Moderator];
      const req = await con
        .getRepository(SourceRequest)
        .save(sourceRequestFixture[2]);
      await authorizeRequest(
        request(app.server).post(`/v1/publications/requests/${req.id}/approve`),
        loggedUser,
        roles,
      )
        .send()
        .expect(204);
      expect(
        await con.getRepository(SourceRequest).findOne({
          where: { id: req.id },
          select: ['approved', 'closed', 'reason'],
        }),
      ).toMatchSnapshot();
    });
  });

  describe('POST /publications/requests/:id/publish', () => {
    it('should publish a source request', async () => {
      loggedUser = '1';
      roles = [Roles.Moderator];
      const req = await con
        .getRepository(SourceRequest)
        .save(sourceRequestFixture[2]);
      await authorizeRequest(
        request(app.server).post(`/v1/publications/requests/${req.id}/publish`),
        loggedUser,
        roles,
      )
        .send()
        .expect(204);
      expect(
        await con.getRepository(SourceRequest).findOne({
          where: { id: req.id },
          select: ['approved', 'closed'],
        }),
      ).toMatchSnapshot();
    });
  });
});

describe('query sourceRequestAvailability', () => {
  const QUERY = `{
    sourceRequestAvailability {
      hasAccess
  }
}`;

  it('should not authorize when not logged in', () =>
    testQueryErrorCode(
      client,
      {
        query: QUERY,
      },
      'UNAUTHENTICATED',
    ));

  it('should return access when user reputaion is above threshold', async () => {
    loggedUser = '1';

    await con.getRepository(User).save({
      ...usersFixture[0],
      reputation: 250,
    });

    const res = await client.query(QUERY);

    expect(res.data).toMatchObject({
      sourceRequestAvailability: {
        hasAccess: true,
      },
    });
  });

  it('should not return access when user reputaion is below threshold', async () => {
    loggedUser = '1';

    await con.getRepository(User).save({
      ...usersFixture[0],
      reputation: 10,
    });

    const res = await client.query(QUERY);

    expect(res.data).toMatchObject({
      sourceRequestAvailability: {
        hasAccess: false,
      },
    });
  });
});

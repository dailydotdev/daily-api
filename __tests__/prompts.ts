import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
} from './helpers';
import { Prompt } from '../src/entity/Prompt';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

afterAll(() => disposeGraphQLTesting(state));

beforeEach(async () => {
  loggedUser = null;

  await con.getRepository(Prompt).save([
    {
      id: 'prompt1',
      order: 1,
      label: 'label1',
      description: 'description1',
      prompt: 'prompt1',
      flags: { icon: 'icon1', color: 'color1' },
    },
    {
      id: 'prompt2',
      order: 2,
      label: 'label2',
      description: 'description2',
      prompt: 'prompt2',
      flags: { icon: 'icon2', color: 'color2' },
    },
    {
      id: 'prompt3',
      order: 3,
      label: 'label3',
      description: 'description3',
      prompt: 'prompt3',
      flags: { icon: 'icon3', color: 'color3' },
    },
  ]);
});

describe('query prompts', () => {
  const QUERY = `{
    prompts {
      id
      label
      description
      flags {
        icon
        color
      }
    }
  }`;

  it('should return all prompts in order', async () => {
    const res = await client.query(QUERY);

    expect(res.data.prompts).toEqual([
      {
        id: 'prompt1',
        label: 'label1',
        description: 'description1',
        flags: { icon: 'icon1', color: 'color1' },
      },
      {
        id: 'prompt2',
        label: 'label2',
        description: 'description2',
        flags: { icon: 'icon2', color: 'color2' },
      },
      {
        id: 'prompt3',
        label: 'label3',
        description: 'description3',
        flags: { icon: 'icon3', color: 'color3' },
      },
    ]);
  });
});

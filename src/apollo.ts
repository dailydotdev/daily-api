import { ApolloServer, Config } from 'apollo-server-fastify';
import { buildSchema } from 'type-graphql';

// import { Context } from './Context';

// const authChecker: AuthChecker<Context> = ({ context }) => {
//   return !!context.userId;
// };

export default async function (config: Config): Promise<ApolloServer> {
  const schema = await buildSchema({
    resolvers: [],
    emitSchemaFile: !process.env.NODE_ENV,
  });
  return new ApolloServer({
    schema,
    ...config,
  });
}

import { gql, IResolvers } from 'apollo-server-fastify';
import { Context } from '../Context';

export interface GQLUser {
  id: string;
  name: string;
  image: string;
  username?: string;
}

export const typeDefs = gql`
  """
  Registered user
  """
  type User {
    """
    ID of the user
    """
    id: String!
    """
    Full name of the user
    """
    name: String!
    """
    Profile image of the user
    """
    image: String!
    """
    Username (handle) of the user
    """
    username: String
    """
    URL to the user's profile page
    """
    permalink: String!
  }
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = {
  User: {
    permalink: (user: GQLUser): string =>
      `${process.env.COMMENTS_PREFIX}/${user.username ?? user.id}`,
  },
};

import { gql } from 'apollo-server-fastify';

export interface GQLUser {
  id: string;
  name: string;
  image: string;
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
  }
`;

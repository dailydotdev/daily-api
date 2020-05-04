import { gql } from 'apollo-server-fastify';
import { GQLSource } from './sources';

export interface GQLPost {
  id: string;
  publishedAt?: Date;
  createdAt: Date;
  url: string;
  title: string;
  image?: string;
  ratio?: number;
  placeholder?: string;
  readTime?: number;
  source?: GQLSource;
  tags?: string[];
}

export const typeDefs = gql`
  """
  Blog post
  """
  type Post {
    """
    Unique identifier
    """
    id: ID!

    """
    Time the post was published
    """
    publishedAt: DateTime

    """
    Time the post was added to the database
    """
    createdAt: DateTime!

    """
    URL to the post
    """
    url: String!

    """
    Title of the post
    """
    title: String!

    """
    URL to the image of post
    """
    image: String

    """
    Aspect ratio of the image
    """
    ratio: Float

    """
    Tiny version of the image in base64
    """
    placeholder: String

    """
    Estimation of time to read the article (in minutes)
    """
    readTime: Float

    source: Source

    tags: [String]
  }

  type PostConnection {
    pageInfo: PageInfo!
    edges: [PostEdge!]!
  }

  type PostEdge {
    node: Post!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }
`;

export default `
  type Post {
    id: ID!
    title: String!
    url: String!
    image: String
    ratio: Float
    placeholder: String
    publication_id: ID!
    published_at: String
    created_at: String
    tweeted: Boolean
    views: Int
    promoted: Boolean
    read_time: Int
    bookmarked: Boolean
  }

  extend type Post {
    """
    Get the publication fields for a post
    """
    publication: Publication!

    """
    Get the tags for a post
    """
    tags: [String]
  }

  input QueryPostInput {
    latest: String
    page: Int
    pageSize: Int
    pubs: String
    tags: String
  }

  type Query {
    latest(params: QueryPostInput): [Post!]!
    post(id: ID!): Post!
    bookmarks(params: QueryPostInput): [Post!] !
  }
`;



const sharedPostInputFields = `
  latest: String!
  page: Int!
  pageSize: Int!
`;

export default `
  type Post {
    id: ID!
    title: String!
    url: String!
    image: String
    ratio: Float
    placeholder: String
    publishedAt: String
    createdAt: String
    tweeted: Boolean
    views: Int
    promoted: Boolean
    readTime: Int
    bookmarked: Boolean
    read: Boolean
  }

  # Fields added on the fly
  extend type Post {
    """
    In the 'toilet' context
    """
    type: String
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
  
  type SearchSuggestion {
    title: String
  }
  
  type SearchSuggestionResults {
    query: String
    hits: [Post]
  }
  
  type PostSearchResults {
    query: String
    hits: [Post]
  }
  
  input QueryPostInput {
    latest: String
    page: Int
    pageSize: Int
    pubs: String
    tags: String
    sortBy: String
  }

  input ToiletInput {
    latest: String!
    page: Int
  }

  input PostByPublicationInput {
    ${sharedPostInputFields}
    pub: String!
  }

  input PostByTagInput {
    ${sharedPostInputFields}
    tag: String!
  }

  input PostSearchInput {
    ${sharedPostInputFields}
    query: String!
  }
  
  input PostSearchSuggestionInput {
    query: String!
  }
  
  type Query {
    latest(params: QueryPostInput): [Post!]!
    post(id: ID!): Post!
    bookmarks(params: QueryPostInput): [Post!] !
    toilet(params: ToiletInput): [Post!]!
    postsByPublication(params: PostByPublicationInput): [Post!]!
    postsByTag(params: PostByTagInput): [Post!]!
    search(params: PostSearchInput): PostSearchResults!
    searchSuggestion(params: PostSearchSuggestionInput): SearchSuggestionResults!
  }

  type Mutation {
    SetBookmarks(ids: [ID!]!): [ID!]!
    RemoveBookmark(id: ID!): ID!
    HidePost(id: ID!): ID!
  }
`;

type StoryRelation = {
  postId: string;
  relatedPostId: string;
};

export type StoryFamilies = {
  collectionByChild: Map<string, string>;
  childrenByCollection: Map<string, string[]>;
  getFamilyPostIds: (postId: string) => string[];
};

export const buildStoryFamilies = ({
  relations,
  postIds,
}: {
  relations: StoryRelation[];
  postIds?: Set<string>;
}): StoryFamilies => {
  const collectionByChild = new Map<string, string>();
  const childrenByCollection = new Map<string, string[]>();

  for (const relation of relations) {
    if (
      postIds &&
      (!postIds.has(relation.postId) || !postIds.has(relation.relatedPostId))
    ) {
      continue;
    }

    const children = childrenByCollection.get(relation.postId) || [];
    children.push(relation.relatedPostId);
    childrenByCollection.set(relation.postId, children);
    collectionByChild.set(relation.relatedPostId, relation.postId);
  }

  const getCollectionId = (postId: string): string =>
    collectionByChild.get(postId) || postId;

  return {
    collectionByChild,
    childrenByCollection,
    getFamilyPostIds: (postId) => {
      const collectionId = getCollectionId(postId);
      return [collectionId, ...(childrenByCollection.get(collectionId) || [])];
    },
  };
};

import { messageToJson, Worker } from './worker';
import { CollectionPost, Post, PostRelation, Source } from '../entity';

interface Data {
  collection: Pick<CollectionPost, 'id'>;
}

const worker: Worker = {
  subscription: 'api.post-collection-updated-normalize-sources',
  handler: async (message, con): Promise<void> => {
    const data: Data = messageToJson(message);
    const { collection } = data;

    const distinctSources = await con
      .createQueryBuilder()
      .select('s.id as id')
      .from(PostRelation, 'pr')
      .leftJoin(Post, 'p', 'p.id = pr."relatedPostId"')
      .leftJoin(Source, 's', 's.id = p."sourceId"')
      .where('pr."postId" = :postId', { postId: collection.id })
      .groupBy('s.id, pr."createdAt"')
      .orderBy('pr."createdAt"', 'DESC')
      .getRawMany<Pick<Source, 'id'>>();

    await con.getRepository(CollectionPost).save({
      id: collection.id,
      collectionSources: distinctSources.map((item) => item.id),
    });
  },
};

export default worker;

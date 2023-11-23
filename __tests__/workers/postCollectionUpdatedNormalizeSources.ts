import { expectSuccessfulBackground } from '../helpers';
import worker from '../../src/workers/postCollectionUpdatedNormalizeSources';
import createOrGetConnection from '../../src/db';
import { DataSource } from 'typeorm';
import {
  ArticlePost,
  CollectionPost,
  PostRelation,
  PostType,
  Source,
} from '../../src/entity';
import { PostRelationType } from '../../src/entity/posts/PostRelation';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('postCollectionUpdatedNormalizeSources worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();

    await con.getRepository(Source).save(sourcesFixture);
    await con.getRepository(ArticlePost).save(postsFixture);
    await con.getRepository(CollectionPost).save({
      id: 'pc1',
      shortId: 'pc1',
      title: 'PC1',
      description: 'pc1',
      image: 'https://daily.dev/image.jpg',
      sourceId: 'a',
      tagsStr: 'javascript,webdev',
      type: PostType.Collection,
      collectionSources: [],
    });
  });

  it('should update collection sources', async () => {
    const collection = await con.getRepository(CollectionPost).findOneByOrFail({
      id: 'pc1',
    });

    expect(collection.collectionSources.length).toBe(0);

    await con.getRepository(PostRelation).save([
      {
        postId: 'pc1',
        relatedPostId: 'p1',
        type: PostRelationType.Collection,
      },
      {
        postId: 'pc1',
        relatedPostId: 'p2',
        type: PostRelationType.Collection,
      },
    ]);

    await expectSuccessfulBackground(worker, {
      collection,
    });

    const collectionAfterWorker = await con
      .getRepository(CollectionPost)
      .findOneByOrFail({
        id: 'pc1',
      });

    expect(collectionAfterWorker.collectionSources.length).toBe(2);
    expect(collectionAfterWorker.collectionSources).toMatchObject(['a', 'b']);
  });

  it('should deduplicate collection sources', async () => {
    const collection = await con.getRepository(CollectionPost).findOneByOrFail({
      id: 'pc1',
    });

    expect(collection.collectionSources.length).toBe(0);

    await con.getRepository(ArticlePost).save([
      {
        id: 'p1',
        sourceId: 'a',
      },
      {
        id: 'p2',
        sourceId: 'a',
      },
    ]);

    await con.getRepository(PostRelation).save([
      {
        postId: 'pc1',
        relatedPostId: 'p1',
        type: PostRelationType.Collection,
      },
      {
        postId: 'pc1',
        relatedPostId: 'p2',
        type: PostRelationType.Collection,
      },
    ]);

    await expectSuccessfulBackground(worker, {
      collection,
    });

    const collectionAfterWorker = await con
      .getRepository(CollectionPost)
      .findOneByOrFail({
        id: 'pc1',
      });

    expect(collectionAfterWorker.collectionSources.length).toBe(1);
    expect(collectionAfterWorker.collectionSources).toMatchObject(['a']);
  });
});

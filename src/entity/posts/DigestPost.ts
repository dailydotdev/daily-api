import { ChildEntity, Column } from 'typeorm';
import { Post, type PostFlags, PostType } from './Post';

export type DigestPostFlags = Partial<{
  digestPostIds: string[];
  collectionSources: string[];
  ad: PostFlags['ad'];
  date: Date;
}>;

@ChildEntity(PostType.Digest)
export class DigestPost extends Post {
  @Column({ type: 'jsonb', default: {} })
  digestFlags: DigestPostFlags;
}

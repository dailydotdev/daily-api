import { ChildEntity } from 'typeorm';
import { Post, PostType } from './Post';

@ChildEntity(PostType.Digest)
export class DigestPost extends Post {}

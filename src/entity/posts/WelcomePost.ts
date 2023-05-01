import { ChildEntity } from 'typeorm';
import { PostType } from './Post';
import { FreeformPost } from './FreeformPost';

@ChildEntity(PostType.Welcome)
export class WelcomePost extends FreeformPost {}

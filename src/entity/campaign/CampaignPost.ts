import { ChildEntity, Column, ManyToOne } from 'typeorm';
import type { Post, FreeformPost, SharePost } from '../posts';
import { Campaign, CampaignType } from './Campaign';

@ChildEntity(CampaignType.Post)
export class CampaignPost extends Campaign {
  @Column({ type: 'text', default: null })
  postId: string;

  @ManyToOne('Post', { lazy: true, onDelete: 'CASCADE' })
  post: Promise<Post | SharePost | FreeformPost>;
}

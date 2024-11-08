import {
  ChildEntity,
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  TableInheritance,
} from 'typeorm';
import type { SourceDisplay } from './SourceDisplay';
import type { SourceFeed } from './SourceFeed';
import type { Post } from './posts';
import type { SourceMember } from './SourceMember';
import type { SourceCategory } from './sources/SourceCategory';

export const COMMUNITY_PICKS_SOURCE = 'community';

export const SQUAD_IMAGE_PLACEHOLDER =
  'https://media.daily.dev/image/upload/s--LrHsyt2T--/f_auto/v1692632054/squad_placeholder_sfwkmj';

export enum SourceType {
  Machine = 'machine',
  Squad = 'squad',
}

export interface SourceFlagsPublic {
  featured: boolean;
  totalViews: number;
  totalPosts: number;
  totalUpvotes: number;
  totalMembers: number;
}

export interface SourceFlagsPrivate {
  publicThreshold: boolean;
}

export const defaultPublicSourceFlags: SourceFlagsPublic = {
  featured: false,
  totalViews: 0,
  totalPosts: 0,
  totalUpvotes: 0,
  totalMembers: 0,
};

export const UNKNOWN_SOURCE = 'unknown';

@Entity()
@Index('IDX_source_activ_priva_img_name_handl_type', [
  'active',
  'private',
  'image',
  'name',
  'handle',
  'type',
])
@Index('IDX_source_activ_priva_id_img_name_handl', [
  'active',
  'private',
  'id',
  'image',
  'name',
  'handle',
])
@Index('IDX_source_type_id', ['type', 'id'])
@Index('IDX_source_private_id', ['private', 'id'])
@TableInheritance({
  column: { type: 'varchar', name: 'type', default: SourceType.Machine },
})
export class Source {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ default: SourceType.Machine })
  type: SourceType;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', default: SQUAD_IMAGE_PLACEHOLDER })
  image: string;

  @Column({ default: false })
  private: boolean;

  @Column({ type: 'text', nullable: true })
  headerImage: string;

  @Column({ type: 'text', nullable: true })
  color: string;

  @Column({
    length: 36,
    transformer: {
      to(value) {
        if (typeof value === 'string') {
          return value?.toLowerCase();
        }
        return value;
      },
      from(value) {
        return value;
      },
    },
  })
  @Index('IDX_source_handle', { unique: true })
  handle: string;

  @Column({ type: 'jsonb', default: {} })
  @Index('IDX_source_flags_featured', { synchronize: false })
  @Index('IDX_source_flags_posts_members_threshold', { synchronize: false })
  @Index('IDX_source_flags_total_members', { synchronize: false })
  flags: SourceFlagsPublic & SourceFlagsPrivate;

  @Column({ type: 'text', nullable: true })
  categoryId?: string;

  @ManyToOne('SourceCategory', (category: SourceCategory) => category.id, {
    lazy: true,
    onDelete: 'SET NULL',
  })
  category: Promise<SourceCategory>;

  @OneToMany('SourceDisplay', (display: SourceDisplay) => display.source, {
    lazy: true,
  })
  displays: Promise<SourceDisplay[]>;

  @OneToMany('SourceFeed', (feed: SourceFeed) => feed.source, { lazy: true })
  feeds: Promise<SourceFeed[]>;

  @OneToMany('Post', (post: Post) => post.source, { lazy: true })
  posts: Promise<Post[]>;

  @OneToMany('SourceMember', (sm: SourceMember) => sm.source, { lazy: true })
  members: Promise<SourceMember[]>;

  @Column({ type: 'text', nullable: true })
  description?: string;
}

@ChildEntity(SourceType.Machine)
export class MachineSource extends Source {
  @Column({ type: 'text', nullable: true })
  twitter?: string;

  @Column({ type: 'text', nullable: true })
  website?: string;

  @Column({ default: 0 })
  rankBoost: number;
}

@ChildEntity(SourceType.Squad)
export class SquadSource extends Source {
  @Column({ default: 0 })
  memberPostingRank: number;

  @Column({ default: 0 })
  memberInviteRank: number;

  @Column({ default: false })
  moderationRequired: boolean;
}

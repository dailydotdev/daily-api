import {
  ChildEntity,
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  TableInheritance,
} from 'typeorm';
import { SourceDisplay } from './SourceDisplay';
import { SourceFeed } from './SourceFeed';
import { Post } from './posts';
import { SourceMember } from './SourceMember';

export const COMMUNITY_PICKS_SOURCE = 'community';

export const SQUAD_IMAGE_PLACEHOLDER =
  'https://daily-now-res.cloudinary.com/image/upload/v1672041320/squads/squad_placeholder.jpg';

export enum SourceType {
  Machine = 'machine',
  Squad = 'squad',
}

export const UNKNOWN_SOURCE = 'unknown';

@Entity()
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

  @OneToMany(() => SourceDisplay, (display) => display.source, { lazy: true })
  displays: Promise<SourceDisplay[]>;

  @OneToMany(() => SourceFeed, (feed) => feed.source, { lazy: true })
  feeds: Promise<SourceFeed[]>;

  @OneToMany(() => Post, (post) => post.source, { lazy: true })
  posts: Promise<Post[]>;

  @OneToMany(() => SourceMember, (sm) => sm.source, { lazy: true })
  members: Promise<SourceMember[]>;
}

@ChildEntity(SourceType.Machine)
export class MachineSource extends Source {
  @Column({ type: 'text', nullable: true })
  twitter?: string;

  @Column({ type: 'text', nullable: true })
  website?: string;

  @Column({ default: 0 })
  rankBoost: number;

  @Column({ type: 'int', array: true, default: [] })
  @Index('IDX_source_advancedSettings')
  advancedSettings: number[];
}

@ChildEntity(SourceType.Squad)
export class SquadSource extends Source {
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ default: 0 })
  memberPostingRank?: number;
}

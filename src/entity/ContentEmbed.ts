import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ContentEmbedParentType {
  Post = 'post',
  Comment = 'comment',
}

export enum ContentEmbedReferenceType {
  Post = 'post',
}

@Entity()
@Index('IDX_content_embed_parent', ['parentType', 'parentId'])
@Index('IDX_content_embed_reference', ['referenceType', 'referenceId'])
export class ContentEmbed {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  parentType: ContentEmbedParentType;

  @Column({ type: 'text' })
  parentId: string;

  @Column({ type: 'text' })
  referenceType: ContentEmbedReferenceType;

  @Column({ type: 'text' })
  referenceId: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'integer' })
  sortOrder: number;

  @Column({ type: 'integer' })
  startOffset: number;

  @Column({ type: 'integer' })
  endOffset: number;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ default: () => 'now()' })
  updatedAt: Date;
}

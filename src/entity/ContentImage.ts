import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export enum ContentImageUsedByType {
  Post = 'post',
  Comment = 'comment',
  User = 'user',
  WorkspacePhoto = 'workspace_photo',
}

@Entity()
@Index('IDX_content_image_used_by', ['usedByType', 'usedById'])
export class ContentImage {
  @PrimaryColumn({ type: 'text' })
  url: string;

  @Column({ type: 'text' })
  serviceId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'text', nullable: true })
  usedByType: ContentImageUsedByType | null;

  @Column({ type: 'text', nullable: true })
  usedById: string | null;
}

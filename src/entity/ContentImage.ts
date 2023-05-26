import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity()
export class ContentImage {
  @PrimaryColumn({ type: 'text' })
  url: string;

  @Column({ type: 'text' })
  serviceId: string;

  @Column({ default: () => 'now()' })
  @Index('IDX_content_image_created_at')
  createdAt: Date;

  @Column({ default: true })
  shouldDelete: boolean;
}

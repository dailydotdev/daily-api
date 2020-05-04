import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity()
export class TagCount {
  @PrimaryColumn({ type: 'text' })
  @Index('IDX_tag_count_tag_search', { synchronize: false })
  tag: string;

  @Column()
  @Index('IDX_tag_count_count', { synchronize: false })
  count: number;
}

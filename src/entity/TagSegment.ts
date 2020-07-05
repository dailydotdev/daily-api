import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity()
export class TagSegment {
  @PrimaryColumn({ type: 'text' })
  tag: string;

  @Column({ type: 'text' })
  @Index()
  segment: string;
}

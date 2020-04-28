import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity()
export class TagCount {
  @PrimaryColumn({ type: 'text' })
  tag: string;

  @Column()
  @Index()
  count: number;
}

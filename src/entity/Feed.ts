import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity()
export class Feed {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  @Index()
  userId: string;
}

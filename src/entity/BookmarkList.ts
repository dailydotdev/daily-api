import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class BookmarkList {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  @Index()
  userId: string;

  @Column({ type: 'text' })
  name: string;
}

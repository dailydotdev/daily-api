import { Category } from './Category';
import { Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';

@Entity()
export class CategoryKeyword {
  @PrimaryColumn({ type: 'text' })
  @Index()
  categoryId: string;

  @PrimaryColumn({ type: 'text' })
  @Index()
  keyword: string;

  @ManyToOne(() => Category, (c) => c.keywords)
  category: Promise<Category>;
}

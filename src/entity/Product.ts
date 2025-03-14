import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ProductFlags = Partial<{
  description: string;
}>;

export type ProductFlagsPublic = Pick<ProductFlags, 'description'>;

export enum ProductType {
  Award = 'award',
  Core = 'core',
}

@Entity()
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: ProductType;

  @Column()
  image: string;

  @Column()
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column()
  value: number;

  @Column({ type: 'jsonb', default: {} })
  flags: ProductFlags;
}

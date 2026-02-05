import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ProductFlags = Partial<{
  description: string;
  imageGlow: string;
}>;

export type ProductFlagsPublic = Pick<
  ProductFlags,
  'description' | 'imageGlow'
>;

export enum ProductType {
  Award = 'award',
  Recruiter = 'recruiter',
}

@Entity()
@Index('idx_product_value_desc', { synchronize: false })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index('idx_product_type')
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

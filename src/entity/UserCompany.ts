import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user';
import { Company } from './Company';

@Entity()
export class UserCompany {
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: false })
  verified: boolean;

  @PrimaryColumn({ type: 'text' })
  @Index({ unique: true })
  email: string;

  @Column({ type: 'text' })
  code: string;

  @PrimaryColumn()
  userId: string;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Promise<User>;

  @Column()
  companyId: string;

  @OneToOne(() => Company, {
    nullable: true,
    lazy: true,
    onDelete: 'CASCADE',
  })
  company: Promise<Company>;
}

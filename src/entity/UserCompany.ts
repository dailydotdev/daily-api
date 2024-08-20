import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from './user';
import { Company } from './Company';

@Entity()
export class UserCompany {
  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ default: () => 'now()' })
  updatedAt: Date;

  @Column({ default: false })
  verified: boolean;

  @PrimaryColumn({ type: 'text' })
  @Index({ unique: true })
  email: string;

  @Column({ type: 'text' })
  @Index({ unique: true })
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
  @JoinColumn({ name: 'companyId' })
  company: Promise<Company>;
}

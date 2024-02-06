import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user';

export enum DevCardTheme {
  Default = 'default',
  Iron = 'iron',
  Bronze = 'bronze',
  Silver = 'silver',
  Gold = 'gold',
  Platinum = 'platinum',
  Diamond = 'diamond',
  Legendary = 'legendary',
}

@Entity()
export class DevCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  @Index('IDX_devcard_userId')
  userId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'text', nullable: true })
  background: string | null;

  @Column({ type: 'enum', enum: DevCardTheme, default: DevCardTheme.Default })
  theme: DevCardTheme;

  @Column({ type: 'bool', default: false })
  isProfileCover: boolean;

  @Column({ type: 'bool', default: true })
  showBorder: boolean;

  @ManyToOne(() => User, (user) => user.devCards, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}

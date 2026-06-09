import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ContributionSponsorTier {
  Gold = 'gold',
  Silver = 'silver',
  Bronze = 'bronze',
}

export const getContributionSponsorTier = (
  amountCents: number,
): ContributionSponsorTier => {
  if (amountCents >= 250000) {
    return ContributionSponsorTier.Gold;
  }

  if (amountCents >= 75000) {
    return ContributionSponsorTier.Silver;
  }

  return ContributionSponsorTier.Bronze;
};

@Entity()
@Index('IDX_contribution_sponsor_active_sort', [
  'active',
  'sortOrder',
  'createdAt',
])
export class ContributionSponsor {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_contribution_sponsor_id',
  })
  id: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'integer' })
  amountCents: number;

  @Column({ type: 'text', nullable: true, default: null })
  url: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  logoUrl: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;
}

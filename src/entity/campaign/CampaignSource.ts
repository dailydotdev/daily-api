import { ChildEntity, Column, ManyToOne } from 'typeorm';
import type { Source } from '../';
import { Campaign, CampaignType } from './Campaign';

@ChildEntity(CampaignType.Source)
export class CampaignSource extends Campaign {
  @Column({ type: 'text', default: null })
  sourceId: string;

  @ManyToOne('Source', { lazy: true, onDelete: 'CASCADE' })
  source: Promise<Source>;
}

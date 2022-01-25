import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class Settings {
  @PrimaryColumn({ type: 'text' })
  userId: string;

  @Column({ type: 'text', default: 'darcula' })
  theme: string;

  @Column({ default: true })
  showTopSites: boolean;

  @Column({ default: false })
  insaneMode: boolean;

  @Column({ type: 'text', default: 'eco' })
  spaciness: string;

  @Column({ default: false })
  showOnlyUnreadPosts: boolean;

  @Column({ default: true })
  openNewTab: boolean;

  @Column({ default: true })
  sidebarExpanded: boolean;

  @Column({ default: false })
  sortingEnabled: boolean;

  @Column({ type: 'text', array: true, default: null })
  customLinks: string[];

  @UpdateDateColumn()
  updatedAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SpotlightActionGroup {
  Navigate = 'Navigate',
  Create = 'Create',
  Settings = 'Settings',
  Actions = 'Actions',
  Help = 'Help',
  Search = 'Search',
}

export enum SpotlightActionKind {
  OpenModal = 'OpenModal',
  OpenUrl = 'OpenUrl',
  Navigate = 'Navigate',
  ToggleSetting = 'ToggleSetting',
  RunClientAction = 'RunClientAction',
}

export type SpotlightActionPlatform = 'webapp' | 'extension';

@Entity({ name: 'spotlight_action' })
@Index('IDX_spotlight_action_active_group_priority', [
  'active',
  'group',
  'priority',
])
export class SpotlightAction {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  group: SpotlightActionGroup;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  subtitle: string | null;

  @Column({ type: 'text' })
  icon: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  keywords: string[];

  @Column({ type: 'text', nullable: true })
  shortcut: string | null;

  @Column({ type: 'text', nullable: true })
  quickKey: string | null;

  @Column({ type: 'boolean', default: false })
  requiresAuth: boolean;

  @Column({ type: 'boolean', default: false })
  requiresPlus: boolean;

  @Column({ type: 'text', array: true, nullable: true })
  platforms: SpotlightActionPlatform[] | null;

  @Column({ type: 'text' })
  kind: SpotlightActionKind;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload: Record<string, unknown>;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

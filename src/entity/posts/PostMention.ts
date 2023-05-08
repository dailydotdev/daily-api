import { Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class PostMention {
  @PrimaryColumn({ length: 14 })
  postId: string;

  @PrimaryColumn({ length: 36 })
  mentionedByUserId: string;

  @PrimaryColumn({ length: 36 })
  mentionedUserId: string;
}

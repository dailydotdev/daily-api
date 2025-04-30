import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class DeletedUser {
  @PrimaryColumn({ length: 36 })
  id: string;

  @CreateDateColumn()
  userDeletedAt: Date;
}

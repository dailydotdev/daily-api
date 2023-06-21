import { Entity, EntityManager, Index, PrimaryColumn } from 'typeorm';

@Entity()
export class DisallowHandle {
  @PrimaryColumn({ unique: true })
  @Index({ unique: true })
  value: string;
}

export const checkDissalowHandle = async (
  entityManager: EntityManager,
  value: string,
): Promise<boolean> => {
  const handle = await entityManager
    .getRepository(DisallowHandle)
    .createQueryBuilder()
    .select('value')
    .where('value = :value', {
      value,
    })
    .getRawOne();
  return !!handle;
};

import type { DataSource } from 'typeorm';
import { DatasetGear } from '../entity/dataset/DatasetGear';
import { classifyGearName } from './gearClassification';
import type { EventLogger } from './pubsub';
import { triggerTypedEvent } from './typedPubsub';

export const normalizeName = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/\./g, 'dot')
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/[-'"/]/g, '')
    .replace(/\s+/g, '');

export const findOrCreateDatasetGear = async (
  con: DataSource,
  name: string,
  log?: EventLogger,
): Promise<DatasetGear> => {
  const nameNormalized = normalizeName(name);
  const repo = con.getRepository(DatasetGear);

  let gear = await repo.findOne({
    where: { nameNormalized },
  });

  if (!gear) {
    const { category, confident } = classifyGearName(name);

    gear = repo.create({
      name: name.trim(),
      nameNormalized,
      category: confident ? category : null,
    });
    await repo.save(gear);

    if (log) {
      await triggerTypedEvent(log, 'api.v1.gear-created', {
        gearId: gear.id,
      });
    }
  }

  return gear;
};

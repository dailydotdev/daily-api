import { GearCategory as ProtoGearCategory } from '@dailydotdev/schema';
import type { TypedWorker } from './worker';
import { DatasetGear } from '../entity/dataset/DatasetGear';
import { UserGear } from '../entity/user/UserGear';
import { GearCategory } from '../common/gearCategory';
import { normalizeName } from '../common/datasetGear';
import { getBragiClient } from '../integrations/bragi/clients';

const getProtoToLocalCategory = (): Record<number, GearCategory> => ({
  [ProtoGearCategory.COMPUTER]: GearCategory.Computer,
  [ProtoGearCategory.MONITOR]: GearCategory.Monitor,
  [ProtoGearCategory.KEYBOARD]: GearCategory.Keyboard,
  [ProtoGearCategory.MOUSE]: GearCategory.Mouse,
  [ProtoGearCategory.HEADPHONES]: GearCategory.Headphones,
  [ProtoGearCategory.DESK]: GearCategory.Desk,
  [ProtoGearCategory.WEBCAM]: GearCategory.Webcam,
  [ProtoGearCategory.MICROPHONE]: GearCategory.Microphone,
  [ProtoGearCategory.OTHER]: GearCategory.Other,
});

const worker: TypedWorker<'api.v1.gear-created'> = {
  subscription: 'api.gear-classify',
  handler: async (message, con, logger): Promise<void> => {
    const { data } = message;
    const { gearId } = data;
    const logDetails = { gearId, messageId: message.messageId };

    try {
      const gear = await con
        .getRepository(DatasetGear)
        .findOneBy({ id: gearId });

      if (!gear) {
        logger.info(logDetails, 'Gear not found, skipping');
        return;
      }

      const bragiClient = getBragiClient();
      const response = await bragiClient.garmr.execute(() =>
        bragiClient.instance.classifyGear({ name: gear.name }),
      );

      const category =
        getProtoToLocalCategory()[response.category] ?? GearCategory.Other;

      const newName = response.normalizedName;
      const nameChanged = newName && newName !== gear.name;

      if (nameChanged) {
        const newNameNormalized = normalizeName(newName);
        const existingGear = await con
          .getRepository(DatasetGear)
          .findOneBy({ nameNormalized: newNameNormalized });

        if (existingGear && existingGear.id !== gearId) {
          await con.transaction(async (manager) => {
            await manager
              .createQueryBuilder()
              .update(UserGear)
              .set({ gearId: existingGear.id })
              .where('gearId = :gearId', { gearId })
              .andWhere(
                'NOT EXISTS (SELECT 1 FROM user_gear ug WHERE ug."userId" = user_gear."userId" AND ug."gearId" = :existingGearId)',
                { existingGearId: existingGear.id },
              )
              .execute();

            await manager.getRepository(UserGear).delete({ gearId });

            await manager.getRepository(DatasetGear).delete({ id: gearId });

            if (!existingGear.category) {
              await manager
                .getRepository(DatasetGear)
                .update(existingGear.id, { category });
            }
          });
          return;
        }

        await con.getRepository(DatasetGear).update(gearId, {
          category,
          name: newName,
          nameNormalized: newNameNormalized,
        });
      } else {
        await con.getRepository(DatasetGear).update(gearId, { category });
      }
    } catch (err) {
      logger.error({ ...logDetails, err }, 'Failed to classify gear');
      throw err;
    }
  },
};

export default worker;

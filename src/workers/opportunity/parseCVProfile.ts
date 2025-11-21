import {
  BrokkrParseRequest,
  CandidatePreferenceUpdated,
} from '@dailydotdev/schema';
import type { TypedWorker } from '../worker';
import { User } from '../../entity/user/User';
import { getBrokkrClient } from '../../common/brokkr';
import { updateFlagsStatement } from '../../common/utils';
import { importUserExperienceFromJSON } from '../../common/profile/import';

export const parseCVProfileWorker: TypedWorker<'api.v1.candidate-preference-updated'> =
  {
    subscription: 'api.parse-cv-profile',
    parseMessage: ({ data }) => CandidatePreferenceUpdated.fromBinary(data),
    handler: async ({ data }, con) => {
      const { userId, cv } = data.payload || {};

      if (!cv?.blob || !cv?.bucket) {
        return;
      }

      if (!cv?.lastModified) {
        return;
      }

      if (!userId) {
        return;
      }

      const user: Pick<User, 'flags'> | null = await con
        .getRepository(User)
        .findOne({
          select: ['flags'],
          where: {
            id: userId,
          },
        });

      if (!user) {
        return;
      }

      const lastModifiedCVDate = new Date(cv.lastModified);

      if (Number.isNaN(lastModifiedCVDate.getTime())) {
        return;
      }

      const lastProfileParseDate = user.flags.lastCVParseAt || new Date(0);

      if (lastModifiedCVDate <= lastProfileParseDate) {
        return;
      }

      const brokkrClient = getBrokkrClient();

      try {
        await con.getRepository(User).update(
          { id: userId },
          {
            flags: updateFlagsStatement<User>({
              lastCVParseAt: new Date(),
            }),
          },
        );

        const result = await brokkrClient.garmr.execute(() => {
          return brokkrClient.instance.parseCV(
            new BrokkrParseRequest({
              bucketName: cv.bucket,
              blobName: cv.blob,
            }),
          );
        });

        const dataJson = JSON.parse(result.parsedCv);

        await importUserExperienceFromJSON({
          con: con.manager,
          dataJson,
          userId,
        });
      } catch (error) {
        // revert to previous date on error
        await con.getRepository(User).update(
          { id: userId },
          {
            flags: updateFlagsStatement<User>({
              lastCVParseAt: user.flags.lastCVParseAt,
            }),
          },
        );

        throw error;
      }
    },
  };

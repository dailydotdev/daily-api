import { TypedWorker } from '../worker';
import {
  PersonalContextStatus,
  UserPersonalContext,
} from '../../entity/user/UserPersonalContext';

export const personalContextGeneratedWorker: TypedWorker<'api.v1.personal-context-generated'> =
  {
    subscription: 'api.personal-context-generated',
    handler: async (message, con) => {
      const { data } = message;
      const { userId, correlationId, status } = data;

      if (!correlationId) {
        return;
      }

      const repo = con.getRepository(UserPersonalContext);
      const row = await repo.findOneBy({ userId, correlationId });

      if (!row) {
        return;
      }

      row.generatedAt = new Date();

      if (status === 'error') {
        row.status = PersonalContextStatus.Error;
        row.error = data.error ?? 'unknown error';
        await repo.save(row);
        return;
      }

      const rankingSignals = data.context?.ranking_signals;

      row.status = PersonalContextStatus.Ok;
      row.profileText = data.profileText ?? null;
      row.boostTags = rankingSignals?.boost_tags ?? [];
      row.muteTags = rankingSignals?.mute_tags ?? [];
      row.context = data.context ?? null;
      row.error = null;

      await repo.save(row);
    },
  };

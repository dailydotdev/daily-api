import type { DataSource, EntityManager } from 'typeorm';
import {
  PersonalContextSource,
  PersonalContextStatus,
  UserPersonalContext,
} from '../../entity/user/UserPersonalContext';
import { generateShortId } from '../../ids';
import { triggerTypedEvent } from '../typedPubsub';
import { logger } from '../../logger';

export const requestPersonalContext = async ({
  con,
  userId,
  source,
  value,
  verified,
}: {
  con: DataSource | EntityManager;
  userId: string;
  source: PersonalContextSource;
  value?: string | null;
  verified: boolean;
}): Promise<boolean> => {
  if (!value) {
    return false;
  }

  const correlationId = await generateShortId();

  await con.transaction(async (manager) => {
    await manager.getRepository(UserPersonalContext).upsert(
      {
        userId,
        source,
        sourceValue: value,
        verified,
        status: PersonalContextStatus.Pending,
        correlationId,
        requestedAt: new Date(),
      },
      ['userId', 'source'],
    );

    await triggerTypedEvent(logger, 'api.v1.generate-personal-context', {
      userId,
      correlationId,
      sources: [{ kind: source, value }],
    });
  });

  return true;
};

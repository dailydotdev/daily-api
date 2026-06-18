import type { DataSource } from 'typeorm';
import { logger as baseLogger } from '../../logger';
import { ChannelHighlightRun } from '../../entity/ChannelHighlightRun';
import {
  getGenerationConfig,
  generateCanonicalHighlights,
  loadCanonicalInput,
  saveCanonicalHighlights,
} from './canonical';
import {
  completeGlobalRun,
  createGlobalRun,
  failGlobalRun,
  fetchPreviousGlobalRun,
} from './runs';
import type { GenerateHighlightsResult } from './types';

export const generateHighlights = async ({
  con,
  now = new Date(),
}: {
  con: DataSource;
  now?: Date;
}): Promise<GenerateHighlightsResult> => {
  const runRepo = con.getRepository(ChannelHighlightRun);
  const previousRun = await fetchPreviousGlobalRun({
    runRepo,
    now,
  });
  const run = await createGlobalRun({
    runRepo,
    now,
  });

  try {
    const config = getGenerationConfig({
      now,
      lastFetchedAt: previousRun?.scheduledAt || null,
    });
    const input = await loadCanonicalInput({
      con,
      config,
      now,
    });
    const canonical = await generateCanonicalHighlights({
      con,
      input,
      config,
      now,
    });

    await con.transaction(async (manager) => {
      await saveCanonicalHighlights({
        manager,
        canonical,
        relations: input.relations,
      });
      await completeGlobalRun({
        manager,
        run,
        config,
        input,
        canonical,
        now,
      });
    });

    return {
      runs: await runRepo.findBy({
        id: run.id,
      }),
      published: canonical.admitted.length > 0,
    };
  } catch (err) {
    baseLogger.error({ err }, 'Failed highlight run');
    await failGlobalRun({
      runRepo,
      run,
      err,
    });
    throw err;
  }
};

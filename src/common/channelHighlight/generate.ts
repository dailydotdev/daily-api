import type { DataSource } from 'typeorm';
import { logger as baseLogger } from '../../logger';
import type { ChannelHighlightDefinition } from '../../entity/ChannelHighlightDefinition';
import { ChannelHighlightRun } from '../../entity/ChannelHighlightRun';
import {
  getGenerationConfig,
  generateCanonicalHighlights,
  loadCanonicalInput,
  saveCanonicalHighlights,
  toCanonicalHighlightsForFanout,
} from './canonical';
import { syncLegacyHighlightsFromCanonical } from './legacyFanout';
import {
  completeGlobalRun,
  createGlobalRun,
  failGlobalRun,
  fetchPreviousGlobalRun,
} from './runs';
import type { GenerateHighlightsResult } from './types';

export const generateHighlights = async ({
  con,
  definitions = [],
  now = new Date(),
}: {
  con: DataSource;
  definitions?: ChannelHighlightDefinition[];
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
      const savedCanonicalHighlights = await saveCanonicalHighlights({
        manager,
        canonical,
        relations: input.relations,
      });
      const legacyFanout = await syncLegacyHighlightsFromCanonical({
        manager,
        definitions,
        canonicalHighlights: toCanonicalHighlightsForFanout({
          canonical,
          savedCanonicalHighlights,
        }),
        posts: input.availablePosts,
        relations: input.relations,
        fallbackPostIds: input.fallbackPostIds,
        now,
      });
      await completeGlobalRun({
        manager,
        run,
        config,
        input,
        canonical,
        legacyFanout,
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

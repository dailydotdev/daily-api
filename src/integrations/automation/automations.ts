import { Automation, IAutomationService } from './types';
import { RetoolAutomationService } from './retool';
import { fetchOptions as globalFetchOptions } from '../../http';
import { ONE_MINUTE_IN_SECONDS } from '../../common';

export const automations: Record<
  Automation,
  IAutomationService<Record<string, unknown>, unknown>
> = {
  roaster: new RetoolAutomationService(process.env.ROASTER_URL, {
    ...globalFetchOptions,
    signal: AbortSignal.timeout(ONE_MINUTE_IN_SECONDS * 1000),
  }),
};

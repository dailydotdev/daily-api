import { Automation, IAutomationService } from './types';
import { RetoolAutomationService } from './retool';
import { fetchOptions as globalFetchOptions } from '../../http';

export const automations: Record<
  Automation,
  IAutomationService<Record<string, unknown>, unknown>
> = {
  roaster: new RetoolAutomationService(process.env.ROASTER_URL, {
    ...globalFetchOptions,
    signal: AbortSignal.timeout(1000 * 60),
  }),
};

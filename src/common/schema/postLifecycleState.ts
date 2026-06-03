import { z } from 'zod';
import {
  PostLifecycleStateValue,
  TRACKED_LIFECYCLE_STATES,
} from '../postLifecycleState';

const trackedStateValues = TRACKED_LIFECYCLE_STATES as ReadonlyArray<string>;

export const postLifecycleStateClickhouseSchema = z.strictObject({
  post_id: z.string(),
  state: z.string(),
  last_updated_at: z.coerce.date(),
});

export const isTrackedLifecycleState = (
  value: string,
): value is PostLifecycleStateValue => trackedStateValues.includes(value);

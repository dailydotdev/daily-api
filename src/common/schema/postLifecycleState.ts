import { z } from 'zod';

export const postLifecycleStateClickhouseSchema = z.strictObject({
  post_id: z.string(),
  state: z.string(),
  last_updated_at: z.coerce.date(),
});

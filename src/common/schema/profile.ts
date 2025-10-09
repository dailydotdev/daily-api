import z from 'zod';
import { UserExperienceType } from '../../entity/user/experiences/types';
import { paginationSchema } from './common';

export const userExperiencesSchema = z
  .object({
    userId: z.string().nonempty(),
    type: z.enum(UserExperienceType).optional(),
  })
  .extend(paginationSchema.shape);

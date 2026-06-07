import type { FastifyReply } from 'fastify';
import type z from 'zod';

export const parseSchema = <TSchema extends z.ZodType>({
  schema,
  value,
  res,
  requireNonEmpty = false,
}: {
  schema: TSchema;
  value: unknown;
  res: FastifyReply;
  requireNonEmpty?: boolean;
}): z.infer<TSchema> | undefined => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    res.status(400).send({
      error: {
        name: parsed.error.name,
        issues: parsed.error.issues,
      },
    });
    return undefined;
  }

  if (
    requireNonEmpty &&
    parsed.data &&
    typeof parsed.data === 'object' &&
    !Array.isArray(parsed.data) &&
    Object.keys(parsed.data).length === 0
  ) {
    res.status(400).send({
      error: {
        name: 'ZodError',
        issues: [{ message: 'At least one field is required' }],
      },
    });
    return undefined;
  }

  return parsed.data;
};

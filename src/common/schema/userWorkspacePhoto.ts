import z from 'zod';

export const addUserWorkspacePhotoSchema = z.object({
  image: z.url(),
});

export type AddUserWorkspacePhotoInput = z.infer<
  typeof addUserWorkspacePhotoSchema
>;

export const reorderUserWorkspacePhotoSchema = z.array(
  z.object({
    id: z.uuid(),
    position: z.number().int().min(0),
  }),
);

export type ReorderUserWorkspacePhotoInput = z.infer<
  typeof reorderUserWorkspacePhotoSchema
>[number];

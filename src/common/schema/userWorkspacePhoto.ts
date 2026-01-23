import z from 'zod';

export const addUserWorkspacePhotoSchema = z.object({
  image: z.url(),
});

export const reorderUserWorkspacePhotoItemSchema = z.object({
  id: z.uuid(),
  position: z.number().int().min(0),
});

export const reorderUserWorkspacePhotoSchema = z
  .array(reorderUserWorkspacePhotoItemSchema)
  .min(1);

export type AddUserWorkspacePhotoInput = z.infer<
  typeof addUserWorkspacePhotoSchema
>;
export type ReorderUserWorkspacePhotoInput = z.infer<
  typeof reorderUserWorkspacePhotoItemSchema
>;

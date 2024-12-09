import { AuthContext } from '../Context';
import { BookmarkList } from '../entity';

export const getFirstFolderId = async (
  ctx: AuthContext,
): Promise<string | null | undefined> => {
  const firstFolder = await ctx.con.getRepository(BookmarkList).findOne({
    select: ['id'],
    where: { userId: ctx.userId },
    order: { createdAt: 'ASC' },
  });

  return firstFolder?.id;
};

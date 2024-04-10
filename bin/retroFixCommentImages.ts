import '../src/config';
import { Comment, ContentImage, ContentImageUsedByType } from '../src/entity';
import createOrGetConnection from '../src/db';
import { DataSource, IsNull, Like } from 'typeorm';

export const retroFixCommentImages = async (ds?: DataSource): Promise<void> => {
  console.log('starting connection');
  const con = ds ?? (await createOrGetConnection());
  const result = await con.getRepository(ContentImage).findBy({
    usedById: IsNull(),
  });

  await Promise.all(
    result.map(async (image) => {
      const comment = await con.getRepository(Comment).findOne({
        where: { contentHtml: Like(`%${image.url}%`) },
      });

      if (comment) {
        // Found comment, update the content image record
        await con.getRepository(ContentImage).update(image.url, {
          usedById: comment.id,
          usedByType: ContentImageUsedByType.Comment,
        });
      }
    }),
  );
  console.log('finished retro checking');
  process.exit();
};

if (process.env.NODE_ENV !== 'test') {
  retroFixCommentImages();
}

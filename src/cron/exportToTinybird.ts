import { Cron } from './cron';
import fetch from 'node-fetch';
import jsonexport from 'jsonexport';
import FormData from 'form-data';
import { PostType, UNKNOWN_SOURCE } from '../entity';

import { promisify } from 'util';

const jsonexportPromise = promisify(jsonexport);

// TODO: need to add tests
const cron: Cron = {
  name: 'export-to-tinybird',
  handler: async (con, logger) => {
    const headers = { Authorization: `Bearer ${process.env.TINYBIRD_TOKEN}` };
    const latestResponse = await (
      await fetch(
        `${process.env.TINYBIRD_HOST}/v0/sql?q=SELECT max(metadata_changed_at) as latest FROM posts_metadata FORMAT JSON`,
        { headers },
      )
    ).json();
    const latest = new Date(latestResponse.data[0].latest);
    logger.info(`fetching post changes since ${latest.toISOString()}`);
    const posts = await con.query(
      `SELECT "id",
              "authorId"          AS "author_id",
              "createdAt"         AS "created_at",
              "metadataChangedAt" AS "metadata_changed_at",
              "creatorTwitter"    AS "creator_twitter",
              "sourceId"          AS "source_id",
              "tagsStr"           AS "tags_str",
              ("banned" or "deleted" or not "showOnFeed")::int AS "banned", "type" AS "post_type",
              "private"::int      AS "post_private",
              "contentCuration"   AS "content_curation"
       FROM "post"
       WHERE "metadataChangedAt" > $1
         and "sourceId" != '${UNKNOWN_SOURCE}'
         and "visible" = true
         and "type" != '${PostType.Welcome}'
      `,
      [latest],
    );
    if (posts.length) {
      const csv = await jsonexportPromise(posts, {
        includeHeaders: false,
        typeHandlers: {
          Date: (date: Date) => date.toISOString(),
        },
      });

      const form = new FormData();
      form.append('csv', csv, 'posts.csv');

      const res = await fetch(
        `${process.env.TINYBIRD_HOST}/v0/datasources?name=posts_metadata&mode=append`,
        {
          method: 'POST',
          body: form,
          headers,
        },
      );
      const text = await res.text();
      if (res.status >= 200 && res.status < 300) {
        logger.info(
          { tinybirdResponse: text },
          `${posts.length} posts replicated successfully to tinybird`,
        );
      } else {
        logger.error(
          { tinybirdResponse: text },
          `failed to replicate posts to tinybird`,
        );
      }
    } else {
      logger.info('no posts to replicate');
    }
  },
};

export default cron;

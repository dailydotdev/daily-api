import '../src/config';
import { fetchTinybirdFeed } from '../src/personalizedFeed';
import createOrGetConnection from '../src/db';

(async (): Promise<void> => {
  const userId = process.env.USER_ID;
  const con = await createOrGetConnection();

  const posts = await fetchTinybirdFeed(con, 30, 2, userId, userId);
  console.log(posts.length);
  console.log(posts.slice(0, 10));
  process.exit();
})();

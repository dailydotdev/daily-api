import createOrGetConnection from '../src/db';

const indexUid = process.argv[2] || 'dailydev';
const meiliBase = process.argv[3] || 'http://localhost:7700';

const meiliFetch = (pathname: string, requestOptions?: RequestInit) => {
  const myHeaders = new Headers(requestOptions?.headers);
  myHeaders.append('Content-Type', 'application/json');
  myHeaders.append('Authorization', 'Bearer topsecret');
  const url = new URL(pathname, meiliBase);

  return fetch(url, {
    ...requestOptions,
    headers: myHeaders,
  });
};

const main = async () => {
  const indexRes = await meiliFetch(`/indexes/${indexUid}`);

  if (indexRes.status === 404) {
    await meiliFetch('/indexes', {
      method: 'POST',
      body: JSON.stringify({
        uid: indexUid,
        primaryKey: 'post_id',
      }),
    });
  }

  const con = await createOrGetConnection();

  // only for local, on prod this query is too big
  const posts = await con.getRepository('Post').createQueryBuilder().getMany();
  const raw = JSON.stringify(
    posts.map(({ id: post_id, ...post }) => ({ ...post, post_id })),
  );

  const taskRes = await meiliFetch(`/indexes/${indexUid}/documents`, {
    method: 'POST',
    body: raw,
  });

  console.log(await taskRes.json());

  process.exit();
};

main();

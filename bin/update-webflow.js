import Webflow from 'webflow-api';
import db from '../src/db';
import config from '../src/config';

const removeItems = (wf, collectionId, items) =>
  // eslint-disable-next-line no-underscore-dangle
  Promise.all(items.map(item => wf.removeItem({ collectionId, itemId: item._id })));

const addItems = (wf, collectionId, items) =>
  Promise.all(items.map(item => wf.createItem({
    collectionId,
    live: true,
    fields: Object.assign({}, item, {
      _archived: false,
      _draft: false,
    }),
  })));

const clearAndNewItems = async (wf, collectionId, limit) => {
  const maxLength = 80;
  const [existingItems, newItems] = await Promise.all([
    wf.items({ collectionId }),
    db.select('title as name', 'image as cover')
      .from('posts')
      .where('created_at', '>=', db.raw('SUBDATE(NOW(), 1) '))
      .orderBy('views', 'desc')
      .limit(limit)
      .map(item => ({
        name: item.name.length > maxLength ?
          `${item.name.substr(0, maxLength - 3)}...` : item.name,
        cover: item.cover || config.defaultImage.url[0],
      })),
  ]);
  await addItems(wf, collectionId, newItems);
  await removeItems(wf, collectionId, existingItems.items);
};

// eslint-disable-next-line no-console
console.log('updating webflow');
const wf = new Webflow({ token: process.env.WEBFLOW_TOKEN });
Promise.all([
  clearAndNewItems(wf, '5e0f1144f72aff36b8494404', 8),
  clearAndNewItems(wf, '5e1c2119db4d521aba00a685', 4),
])
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('done');
    process.exit();
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(-1);
  });

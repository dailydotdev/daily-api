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

const clearAndNewItems = async (wf, collectionId) => {
  const [existingItems, newItems] = await Promise.all([
    wf.items({ collectionId }),
    db.select('title as name', 'image as cover')
      .from('posts')
      .where('created_at', '>=', db.raw('SUBDATE(NOW(), 1) '))
      .orderBy('views', 'desc')
      .limit(8)
      .map(items => Object.assign(
        {},
        items,
        { cover: items.cover || config.defaultImage.url[0] },
      )),
  ]);
  await addItems(wf, collectionId, newItems);
  await removeItems(wf, collectionId, existingItems.items);
};

// eslint-disable-next-line no-console
console.log('updating webflow');
const wf = new Webflow({ token: process.env.WEBFLOW_TOKEN });
const collectionId = '5e0f1144f72aff36b8494404';
clearAndNewItems(wf, collectionId)
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

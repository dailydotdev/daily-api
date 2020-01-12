import tag from '../src/models/tag';

// eslint-disable-next-line no-console
console.log('updating tags');
tag.updateTagsCount()
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

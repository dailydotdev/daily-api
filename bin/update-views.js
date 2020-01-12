import post from '../src/models/post';

// eslint-disable-next-line no-console
console.log('updating views');
post.updateViews()
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

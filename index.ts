import appFunc from './src';

appFunc()
  .then((app) => app.listen(parseInt(process.env.PORT) || 3000, '0.0.0.0'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

import foregroundFunc from './src';
import backgroundFunc from './src/background';

const isBackground = process.argv.reverse()[0] === 'background';
const appFunc = isBackground ? backgroundFunc : foregroundFunc;

appFunc()
  .then((app) => {
    if (isBackground) {
      app.log.info('background processing in on');
    }
    return app.listen(parseInt(process.env.PORT) || 3000, '0.0.0.0');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

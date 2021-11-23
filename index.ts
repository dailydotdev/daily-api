import foregroundFunc from './src';
import backgroundFunc from './src/background';

const isBackground = process.env.MODE === 'background';

(async () => {
  if (isBackground) {
    return backgroundFunc();
  }
  const app = await foregroundFunc();
  return app.listen(parseInt(process.env.PORT) || 3000, '0.0.0.0');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

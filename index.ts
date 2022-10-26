import foregroundFunc from './src';
import backgroundFunc from './src/background';

const isBackground = process.env.MODE === 'background';

(async () => {
  if (isBackground) {
    return backgroundFunc();
  }
  const app = await foregroundFunc();
  return app.listen({
    port: parseInt(process.env.PORT) || 3000,
    host: '0.0.0.0',
  });
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

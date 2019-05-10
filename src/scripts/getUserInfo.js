import { fetchInfo } from '../profile';
import provider from '../models/provider';

const run = async (userId) => {
  const userProvider = await provider.getByUserId(userId);
  return fetchInfo(userProvider);
};

run(process.argv[process.argv.length - 1])
  .then(console.log)
  .then(() => process.exit())
  .catch(console.error);

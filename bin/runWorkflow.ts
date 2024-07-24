import { runReminderWorkflow } from '../src/temporal/notifications/utils';

const afterFiveSeconds = () => Date.now() + 5000;
const userId = 'B4AdaAXLKy1SdZxDhZwL1';
const postId = 's-UJPyk4i';
const params = {
  userId,
  postId,
  remindAt: afterFiveSeconds(),
};

runReminderWorkflow(params)
  .then(() => {
    console.log('Workflow started');
  })
  .catch((err) => {
    console.log('Workflow failed:', err);
  })
  .finally(() => {
    process.exit(1);
  });

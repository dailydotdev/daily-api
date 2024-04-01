import '../src/config';
import { addMinutes } from 'date-fns';
import { sendReadingReminderPush } from '../src/onesignal';

(async (): Promise<void> => {
  const at = addMinutes(new Date(), 1);
  console.log(at);
  await sendReadingReminderPush(['28849d86070e4c099c877ab6837c61f0'], at);
})();

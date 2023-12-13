import './src/config';
import { baseNotificationEmailData, sendEmail } from './src/common';

(async () => {
  await sendEmail({
    ...baseNotificationEmailData,
    to: 'ido@daily.dev',
    templateId: 'd-48de63612ff944cb8156fec17f47f066',
    dynamicTemplateData: {
      rss_link: 'https://daily.dev2',
    },
    personalizations: [
      { to: 'ido@daily.dev', dynamicTemplateData: { first_name: 'Ido' } },
      {
        to: 'idoesh1@gmail.com',
        dynamicTemplateData: { first_name: 'Shamun' },
      },
    ],
  });
})()
  .then(() => process.exit())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

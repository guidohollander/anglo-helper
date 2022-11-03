/* eslint-disable no-console */
const axios = require('axios');

async function postMessageToTeams(title, message) {
  const webhookURL = 'https://bearingpointco.webhook.office.com/webhookb2/dfaf75a2-2287-4790-99cf-1f99cd730fa8@77e59f5e-c89e-4883-822c-b5f9a0c6dd84/IncomingWebhook/88ad28fd012949ecb1c5a95219c4d9a5/faf1dac6-8493-43bc-b462-08fba6e2d0fd'; // this holds my webhook URL
  // const card = {
  //   '@type': 'MessageCard',
  //   '@context': 'http://schema.org/extensions',
  //   themeColor: '0072C6',
  //   summary: 'Summary description',
  //   sections: [
  //     {
  //       activityTitle: title,
  //       text: message,
  //     },
  //   ],
  // };
  const c2 = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          body: [
            {
              type: 'TextBlock',
              size: 'Medium',
              weight: 'Bolder',
              text: title,
            },
            {
              type: 'TextBlock',
              text: `<at>Anglo-helper channel</at> 
              
              ${message}`,
            },
          ],
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          version: '1.0',
          msteams: {
            entities: [
              {
                type: 'mention',
                text: '<at>Anglo-helper channel</at>',
                mentioned: {
                  id: 'bf4e4915.bearingpointcaribbean.com@amer.teams.ms',
                  name: 'Anglo-helper channel',
                },

              },
            ],
          },
        },
      }],
  };

  try {
    const response = await axios.post(webhookURL, c2, {
      headers: {
        'content-type': 'application/vnd.microsoft.teams.card.o365connector',
      },
    });
    return `${response.status} - ${response.statusText}`;
  } catch (err) {
    console.log(err);
    return err;
  }
}
module.exports = {
  postMessageToTeams,
};

/* eslint-disable no-console */
const axios = require('axios');
const state = require('./state');

async function postMessageToTeams(title, message, postedBy, notifyPublicly = false) {
  let webhookURL = 'https://bearingpointco.webhook.office.com/webhookb2/cd4f55b8-814a-4514-9bea-e17a2f880c7c@77e59f5e-c89e-4883-822c-b5f9a0c6dd84/IncomingWebhook/83b181282bbf4dbaa786ad18a1787e3e/faf1dac6-8493-43bc-b462-08fba6e2d0fd'
  let mentionEmailaddress = 'a891cf94.bearingpointcaribbean.com@amer.teams.ms';
  if (notifyPublicly) {
    // override webhookURL to actual non-experimental teams channel
    // webhookURL = 'https://bearingpointco.webhook.office.com/webhookb2/dfaf75a2-2287-4790-99cf-1f99cd730fa8@77e59f5e-c89e-4883-822c-b5f9a0c6dd84/IncomingWebhook/88ad28fd012949ecb1c5a95219c4d9a5/faf1dac6-8493-43bc-b462-08fba6e2d0fd'; // this holds my webhook URL
    webhookURL = 'https://bearingpointco.webhook.office.com/webhookb2/dfaf75a2-2287-4790-99cf-1f99cd730fa8@77e59f5e-c89e-4883-822c-b5f9a0c6dd84/IncomingWebhook/88ad28fd012949ecb1c5a95219c4d9a5/faf1dac6-8493-43bc-b462-08fba6e2d0fd/V2XVCZMElxnTrXm6cAdINAgblu9LlOG42JZ1SRhdWYps41'; // this holds my webhook URL
    mentionEmailaddress = 'bf4e4915.bearingpointcaribbean.com@amer.teams.ms';
  }
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
              
              ${message}\n\nby ${postedBy}`,
            },
          ],
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          version: '1.2',
          msteams: {
            width: 'full',
            entities: [
              {
                type: 'mention',
                text: '<at>Anglo-helper channel</at>',
                mentioned: {
                  id: `${mentionEmailaddress}`,
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

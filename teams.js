/* eslint-disable no-console */
const axios = require('axios');

async function postMessageToTeams(title, message) {
  const webhookURL = 'https://bearingpointco.webhook.office.com/webhookb2/dfaf75a2-2287-4790-99cf-1f99cd730fa8@77e59f5e-c89e-4883-822c-b5f9a0c6dd84/IncomingWebhook/88ad28fd012949ecb1c5a95219c4d9a5/faf1dac6-8493-43bc-b462-08fba6e2d0fd'; // this holds my webhook URL
  const card = {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: '0072C6',
    summary: 'Summary description',
    sections: [
      {
        activityTitle: title,
        text: message,
      },
    ],
  };

  try {
    const response = await axios.post(webhookURL, card, {
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

const mqtt = require('mqtt');
const state = require('./state');

const mqttTopic = 'bearingpoint/';

// Connect to the MQTT broker
const client = mqtt.connect('mqtt://broker.hivemq.com');

// Subscribe to a topic
// Receive MQTT messages
client.on('message', (topic, message) => {
  console.log(`RECEIVER: received message on ${topic}: ${message.toString()}`);
});

module.exports = {
  client,
  mqttTopic,
};

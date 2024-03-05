const anglo = require('./anglo');
const consoleLog = require('./consoleLog');
const state = require('./state');

async function perform(componentEntry) {
  if (componentEntry.isExternal && componentEntry.isFrontEnd) {
    if (componentEntry.isTagged) {
      consoleLog.logThisLine('[D]', 'green');
    } else {
      anglo.memorable('[D]', state.arrDeploymentCheckCollection, componentEntry, componentEntry.key, 'red');
    }
  } else {
    // not external
  }
}
module.exports = {
  perform,
};

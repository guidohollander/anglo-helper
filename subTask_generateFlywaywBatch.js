/* eslint-disable no-restricted-syntax */
async function perform(componentEntry) {
  if (componentEntry.isCoreComponent) {
    console.log(componentEntry);
  }
}

module.exports = {
  perform,
};

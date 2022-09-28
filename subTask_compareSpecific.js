const path = require('path');
const anglo = require('./anglo');
const consoleLog = require('./consoleLog');
const state = require('./state');
const promises = require('./promises');

async function checkPath(folder, baseToReplace) {
  const bixmlContainingPaths = new Set();
  try {
    const files = await promises.globPromise(`${folder}/**/*.bixml`);
    // eslint-disable-next-line no-restricted-syntax
    for (const file of files) {
      bixmlContainingPaths.add(path.join(file.replace(baseToReplace, '')));
    }
  } catch (error) {
    // console.log(error)
    consoleLog.logNewLine(error, 'gray');
  }
  return bixmlContainingPaths;
}
function getDifference(setA, setB) {
  return new Set(
    [...setA].filter((element) => !setB.has(element)),
  );
}
async function perform(componentEntry) {
  const dir = anglo.unifyPath(state.workingCopyFolder) + componentEntry.key;
  if (componentEntry.isInternal && ((anglo.appIsFullyComparable(state.oAppContext, state.profile) && componentEntry.isDomainSpecific) || componentEntry.isSolutionComponent)) {
    const leftSideFolder = dir;
    const rightSideFolder = leftSideFolder.replace(state.workingCopyFolder, state.profile.compareSpecificRootFolder.toLowerCase());
    const leftSet = await checkPath(leftSideFolder, state.workingCopyFolder);
    const rightSet = await checkPath(rightSideFolder, state.profile.compareSpecificRootFolder.toLowerCase());
    const difference = new Set([
      ...getDifference(leftSet, rightSet),
      ...getDifference(rightSet, leftSet),
    ]);
    if (difference.size > 0) {
      anglo.memorable('[C]', state.arrCompareSpecificUpdateCollection, componentEntry, componentEntry.key, 'red');
      consoleLog.logNewLine('', 'red');
      difference.forEach((dif) => {
        consoleLog.logNewLine('', 'red');
        consoleLog.logThisLine('[C] - ', 'red');
        consoleLog.logThisLine(dif, 'gray');
      });
      consoleLog.logNewLine('', 'red');
    } else {
      consoleLog.logThisLine('[C]', 'gray');
    }
  } else {
    // compareSpecific enabled, but not an internal/specific project
  }
}
module.exports = {
  perform,
};

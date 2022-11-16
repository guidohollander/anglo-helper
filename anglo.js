const fs = require('fs');
const clargs = require('./arguments');
const consoleLog = require('./consoleLog');
const promises = require('./promises');
const state = require('./state');

function alertTerminal(mode) {
  if ((mode === 'F') || (mode.includes('U')) || (mode.includes('S')) || (mode === 'C')) {
    // beep(1);
  }
}
function determineProbableAngloApp(angloPath) {
  let probableAngloApp;
  if ((angloPath.toLowerCase().includes('mbs')) && (!angloPath.toLowerCase().includes('mts'))) {
    probableAngloApp = 'mbs';
  } else if ((angloPath.toLowerCase().includes('mts')) && (!angloPath.toLowerCase().includes('mbs'))) {
    probableAngloApp = 'mts';
  }
  return probableAngloApp;
}
function appIsFullyComparable(oAppContext, profile) {
  return (oAppContext.app === determineProbableAngloApp(profile.compareSpecificRootFolder.toLowerCase()));
}

function getProbableApp() {
  const svnDir = '.svn';
  const cwd = process.cwd().toLowerCase();
  let probableApp = '';
  if (fs.existsSync(svnDir)) {
    consoleLog.logNewLine('Do not run this application in an SVN working copy folder. Move to the root of your workspace or an empy folder.', 'red');
    process.exit(0);
  }
  if (clargs.argv.app) {
    probableApp = clargs.argv.app;
  } else if (cwd.includes('mbs') || cwd.includes('mts')) {
    probableApp = determineProbableAngloApp(cwd);
  } else if ((fs.existsSync('./MBS Portal'))) {
    probableApp = 'mbs';
  } else if ((fs.existsSync('./MTS Portal'))) {
    probableApp = 'mts';
  } else {
    consoleLog.logNewLine('App could not be determined automatically. Please provide an --app as argument.', 'gray');
    process.exit(0);
  }
  return {
    app: probableApp,
    workingCopyFolder: cwd,
  };
}

async function getProfileSequenceNumber() {
  const files = await promises.globPromise('profile_[0-9]*.json');
  if (files.length > 0) {
    return parseInt(files.sort().reverse()[0].toString().split('_').reverse()[0].replace('.json', ''), 10) + 1;
  }
  return 0;
}
function unifyPath(angloPath) {
  return angloPath.toString().toLowerCase().replaceAll('\\', '/');
}
function getWorkingCopyFolder(oAppContext) {
  if (clargs.argv.workingCopyFolder) {
    return unifyPath(clargs.argv.workingCopyFolder);
  }
  return `${unifyPath(oAppContext.workingCopyFolder)}/`;
}
function memorable(symbol, collection, entry, payload, color) {
  consoleLog.logThisLine(symbol, color);
  alertTerminal(symbol);
  collection.push(entry.key);
}
function tidyArrayContent(entry) {
  let inputEntry = entry;
  if (inputEntry.includes(state.oSVNInfo.baseURL)) {
    inputEntry = inputEntry.replace(state.oSVNInfo.baseURL, '/');
  }

  let name = '';
  let item;
  if (inputEntry.includes('\'')) {
    item = inputEntry.split(" '");
  } else {
    item = inputEntry.split(' ');
  }
  const path = item[0];
  if (item.length === 2) {
    name = item[1].replace(/[']/g, '');
  } else if (item.length === 1) {
    // eslint-disable-next-line prefer-destructuring
    name = item[0];
  }
  return { path, name };
}
function move(array, from, to, on = 1) {
  // eslint-disable-next-line no-sequences
  return array.splice(to, 0, ...array.splice(from, on)), array;
}

function moveComponent(array) {
  let componentIndex;
  const portalName = `${state.app.toUpperCase()} Portal`;
  componentIndex = array.findIndex((object) => object.key === '_CONTINUOUS_DELIVERY');
  move(array, componentIndex, array.length - 1);
  if (clargs.argv.select) {
    componentIndex = array.findIndex((object) => object.key === portalName);
    move(array, componentIndex, 0);
  }
}

module.exports = {
  appIsFullyComparable,
  getProbableApp,
  getProfileSequenceNumber,
  getWorkingCopyFolder,
  memorable,
  moveComponent,
  tidyArrayContent,
  unifyPath,
};

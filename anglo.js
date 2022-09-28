const fs = require('fs');
const beep = require('node-beep');
const clargs = require('./arguments');
const consoleLog = require('./consoleLog');
const promises = require('./promises');

function alertTerminal(mode) {
  if ((mode === 'F') || (mode.includes('U')) || (mode.includes('S')) || (mode === 'C')) {
    beep(1);
  }
}
function determineProbableAngloApp(path) {
  let probableAnloApp;
  if ((path.toLowerCase().includes('mbs')) && (!path.toLowerCase().includes('mts'))) {
    probableAnloApp = 'mbs';
  } else if ((path.toLowerCase().includes('mts')) && (!path.toLowerCase().includes('mbs'))) {
    probableAnloApp = 'mts';
  }
  return probableAnloApp;
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
    process.exit();
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
function unifyPath(path) {
  return path.toString().toLowerCase().replaceAll('\\', '/');
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
  let name = '';
  let item;
  if (entry.includes('\'')) {
    item = entry.split(" '");
  } else {
    item = entry.split(' ');
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
module.exports = {
  appIsFullyComparable,
  getProbableApp,
  getProfileSequenceNumber,
  getWorkingCopyFolder,
  memorable,
  tidyArrayContent,
  unifyPath,
};

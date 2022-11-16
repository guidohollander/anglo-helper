const fs = require('fs');
const anglo = require('./anglo');
const clargs = require('./arguments');
const consoleLog = require('./consoleLog');
const state = require('./state');
const promises = require('./promises');
const svn = require('./svn');

async function perform(componentEntry) {
  const switchPath = state.oSVNInfo.baseURL + componentEntry.path;
  const dirWithQuotedProjectName = anglo.unifyPath(state.workingCopyFolder) + JSON.stringify(componentEntry.key);
  if (!state.beInformedRunning) {
    if (!componentEntry.match) {
      const cloneSvnOptions = JSON.parse(JSON.stringify(svn.svnOptions));
      cloneSvnOptions.includeExternal = true;
      cloneSvnOptions.vacuumPristines = true;
      // await promises.svnCleanUpPromise(dirWithQuotedProjectName, cloneSvnOptions);
      try {
        const switched = await promises.svnSwitchPromise(JSON.stringify(switchPath), dirWithQuotedProjectName, svn.svnOptions);
        anglo.memorable('[S]', state.arrSwitchUpdateCollection, componentEntry, switched, 'green');
      } catch (error) {
        consoleLog.logThisLine('[Š] Errors while switching', 'red');
        if (clargs.argv.allowUnlink) {
          fs.unlink(componentEntry.local_path, ((err) => {
            if (!err) { anglo.memorable('[D]', state.arrUnlinkedFolderCollection, componentEntry, state.oSVNInfo.baseURL + componentEntry.path.replace(/^\//, '').key, 'green'); }
          }));
        }
      }
    } else {
      // no switch necessary
      consoleLog.logThisLine('[S]', 'gray');
    }
  } else if (!componentEntry.match) {
    // potential switch, since be informed is running
    consoleLog.logThisLine('[Š]', 'yellow');
  } else {
    // no switch necessary
    consoleLog.logThisLine('[Š]', 'gray');
  }
}
module.exports = {
  perform,
};

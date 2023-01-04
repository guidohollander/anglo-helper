const anglo = require('./anglo');
const consoleLog = require('./consoleLog');
const state = require('./state');
const promises = require('./promises');
const svn = require('./svn');
const util = require('./util');

async function perform(componentEntry) {
  const dirWithQuotedProjectName = anglo.unifyPath(state.workingCopyFolder) + JSON.stringify(componentEntry.key);
  if (!state.beInformedRunning) {
    const cloneSvnOptions = JSON.parse(JSON.stringify(svn.svnOptions));
    cloneSvnOptions.includeExternal = true;
    cloneSvnOptions.vacuumPristines = true;

    try {
      await promises.svnCleanUpPromise(dirWithQuotedProjectName, cloneSvnOptions);
      const updated = await promises.svnUpdatePromise(dirWithQuotedProjectName, svn.svnOptions);
      if (updated.includes('Updated to revision')) {
        if (state.profile.verbose) {
          anglo.memorable('[U]', state.arrSVNUpdatedCollection, componentEntry, updated, 'green');
          // consoleLog.logNewLine('', 'gray');
        } else {
          anglo.memorable('[U]', state.arrSVNUpdatedCollection, componentEntry, updated, 'green');
        }
      }
      if (updated.includes('At revision')) {
        consoleLog.logThisLine('[U]', 'gray');
      }
      if (updated.includes('Summary of conflicts')) {
        if (state.profile.verbose) {
          consoleLog.logNewLine(`[U] conflict detected, Resolve conflict(s) first: ${updated}`, 'gray'); // chalk.red(
          util.beep(3);
          process.exit();
        }
      }
    } catch (error) {
      consoleLog.logThisLine('[Ŭ] Errors while updating', 'red');
    }
  } else {
    // [U] enabled, but BI is running, so [Ŭ]. Only incoming updates, not outgoing
    const svnStatusOptions = JSON.parse(JSON.stringify(svn.svnOptions));
    svnStatusOptions.params = [`--allow-mixed-revisions --dry-run -r BASE:HEAD ${dirWithQuotedProjectName}`];
    const mergeList = await promises.svnMergePromise(dirWithQuotedProjectName, svnStatusOptions);
    if (mergeList) {
      anglo.memorable('[Ŭ]', state.arrSVNPotentialUpdateCollection, componentEntry, mergeList, 'yellow');
      if (state.profile.verbose) {
        consoleLog.logNewLine('', 'gray');
        consoleLog.logNewLine('', 'gray');
        consoleLog.logNewLine(mergeList.replace(/^--- Merging .*/m, ''), 'yellow');
      }
    } else {
      // [Ŭ] no action needed
      consoleLog.logThisLine('[Ŭ]', 'gray');
    }
  }
}
module.exports = {
  perform,
};

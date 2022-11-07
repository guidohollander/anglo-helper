const inquirer = require('inquirer');
const path = require('path');

const consoleLog = require('./consoleLog');
const promises = require('./promises');
const state = require('./state');
const svn = require('./svn');

async function perform() {
  consoleLog.renderTitleToVersion();
  const svnToVersionTagsChoices = await promises.svnListPromise(`${state.oSVNInfo.appRoot}/tags`);
  const qTags = svnToVersionTagsChoices.list.entry.filter((q) => !q.name.startsWith('cd_')).slice(-0).map((b) => 'tags/'.concat(b.name));
  const svnToVersionBranchesChoices = await promises.svnListPromise(`${state.oSVNInfo.appRoot}/branches`);
  const qBranches = svnToVersionBranchesChoices.list.entry.filter((q) => !q.name.startsWith('cd_')).slice(-0).map((b) => 'branches/'.concat(b.name));
  const qarrToVersion = qBranches.concat(qTags);
  qarrToVersion.push('trunk');
  const questionsToVersion = [
    {
      type: 'list',
      name: 'selectedSVNVersion',
      message: 'Pick a version, any version.',
      choices: qarrToVersion,
      default: state.oSVNInfo.currentVersion,
    }];
  await inquirer
    .prompt(questionsToVersion)
    .then((answersToVersion) => {
      state.oSVNInfo.remoteRepo = state.oSVNInfo.appRoot + answersToVersion.selectedSVNVersion;
      const urlParts = state.oSVNInfo.remoteRepo.split('/');
      state.oSVNInfo.angloSVNPath = urlParts[urlParts.length - 1];
      state.oSVNInfo.repo = urlParts[urlParts.length - 2];
      state.oSVNInfo.svnAndApp = `/svn/${urlParts[urlParts.length - 3]}/`;
      state.oSVNInfo.currentVersion = `${state.oSVNInfo.repo}/${state.oSVNInfo.angloSVNPath}`;
      const fn = 'profile_1.json';
      // eslint-disable-next-line import/no-dynamic-require, global-require
      state.profile = require(path.normalize(state.workingCopyFolder + fn));
      state.profile.filename = fn;
      svn.getSVNContext(state.app, state.workingCopyFolder, answersToVersion.selectedSVNVersion);
    })
    .catch((error) => {
      if (error.isTtyError) {
        // eslint-disable-next-line no-console
      } else {
        // eslint-disable-next-line no-console
        console.dir(error);
      }
    });
}
module.exports = {
  perform,
};

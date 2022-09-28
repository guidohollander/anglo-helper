const inquirer = require('inquirer');
const semver = require('semver');
const fs = require('fs');
const path = require('path');
const consoleLog = require('./consoleLog');
const clargs = require('./arguments');
const promises = require('./promises');
const state = require('./state');
const util = require('./util');
// public variables]
const svnOptions = { trustServerCert: true };
async function getArrExternals(url) {
  const svnExternals = await promises.svnPropGetPromise('svn:externals', `${url}`, svnOptions);
  return svnExternals.target.property._.split('\r\n');
}
async function getSVNContext(app, workingCopyFolder, switchedTo) {
  const dirWithQuotedProjectName = (`${workingCopyFolder}\\${JSON.stringify(`${app.toUpperCase()} Portal`)}`).replace(/[\\/]+/g, '/');// .replace(/^([a-zA-Z]+:|\.\/)/, '');
  const dir = `.//${app.toUpperCase()} Portal`;
  let appRoot = `https://svn.${state.profile ? state.profile.domain : clargs.argv.domain}/svn/${state.app}_anguilla`;
  if (!clargs.argv.domain && !fs.existsSync(path.normalize(`${workingCopyFolder}profile_1.json`))) {
    consoleLog.logNewLine('Cannot determine domain, please specify your organisational domain as argument, ie: --domain mycompany.org or --domain microsoft.com', 'gray');
    process.exit(0);
  }
  if (!fs.existsSync(dir)) {
    consoleLog.renderTitleToVersion();
    let qBranches;
    try {
      // if provided, add username and password to the svn options
      if (clargs.argv.svnOptionsUsername && clargs.argv.svnOptionsPassword) {
        svnOptions.username = clargs.argv.svnOptionsUsername;
        svnOptions.password = clargs.argv.svnOptionsPassword;
      }
      const svnToVersionBranchesChoices = await promises.svnListPromise(`${appRoot}/branches`, svnOptions);
      qBranches = svnToVersionBranchesChoices.list.entry.filter((q) => !q.name.startsWith('cd_')).slice(-10).map((b) => 'branches/'.concat(b.name));
    } catch (error) {
      consoleLog.logThisLine('Can\'t login into SVN. Provide them on the command line, at least once, using --svnOptionsUsername [username] --svnOptionsPassword [password] ', 'red');
      process.exit(0);
    }
    const qarrToVersion = qBranches;
    qarrToVersion.push('trunk');
    const questionsToVersion = [
      {
        type: 'list',
        name: 'selectedSVNVersion',
        message: 'Pick a version, any version.',
        choices: qarrToVersion,
        default: 'trunk',
      }];
    await inquirer
      .prompt(questionsToVersion)
      .then(async (answersToVersion) => {
        const url = `https://svn.${state.profile ? state.profile.domain : clargs.argv.domain}/svn/${state.app.toUpperCase()}_ANGUILLA/${answersToVersion.selectedSVNVersion}/${state.app.toUpperCase()} Portal`;
        const execCommand = `svn checkout "${url}" "${dir}" --non-interactive`;
        await util.execShellCommand(execCommand);
      })
      .catch((error) => {
        if (error.isTtyError) {
          consoleLog.logNewLine('Your console environment is not supported!', 'gray');
        } else {
          consoleLog.logNewLine(error, 'gray');
        }
      });
  }
  const infoResult = await promises.svnInfoPromise(dirWithQuotedProjectName);
  // Define desired object
  const URL = infoResult.entry.url;
  const urlParts = URL.split('/');
  state.angloSVNPath = urlParts[urlParts.length - 2];
  if (switchedTo) {
    state.angloSVNPath = switchedTo;
  }
  const repo = urlParts[urlParts.length - 3];
  let svnAndApp;
  let svnApp;
  if (state.angloSVNPath === 'trunk') {
    svnAndApp = `/${urlParts[3]}/`;
    // eslint-disable-next-line prefer-destructuring
    svnApp = urlParts[4];
  } else {
    svnAndApp = `/${urlParts[3]}/${urlParts[4]}/`;
    // eslint-disable-next-line prefer-destructuring
    svnApp = urlParts[4];
  }
  const angloClient = svnApp.toLowerCase().replace(`${state.app}_`, '');
  const currentVersion = `${repo}/${state.angloSVNPath}`;
  const baseURL = `${urlParts.slice(0, 3).join('/')}/`;
  appRoot = `${urlParts.slice(0, 5).join('/')}/`;
  const remoteRepo = urlParts.slice(0, urlParts.length - 1).join('/');
  return {
    URL,
    angloSVNPath: state.angloSVNPath,
    repo,
    svnAndApp,
    svnApp,
    angloClient,
    baseURL,
    appRoot,
    currentVersion,
    remoteRepo,
  };
}
// get revision info of previous trunk/tag/branch
async function getTag(url, tagNumberinPreviousSolution) {
  const bSolutionOrComponentOnTrunk = url.includes('trunk');
  // get list of tags of this entry
  const arrUrl = url.split('/');
  const svnPathPartLength = bSolutionOrComponentOnTrunk ? 1 : 2;
  const svnPathPart = arrUrl.splice(-svnPathPartLength);
  const actualSvnTrunkBranchOrTagPart = svnPathPart[0].replace('"', '');
  const derivedSvnTrunkBranchOrTagPart = bSolutionOrComponentOnTrunk ? 'tags' : actualSvnTrunkBranchOrTagPart;
  const actualSvnTrunkBranchOrTagNumberPart = svnPathPart[svnPathPart.length - 1].replace('"', '');
  const derivedSvnTrunkBranchOrTagNumberPart = actualSvnTrunkBranchOrTagNumberPart === 'undefined' ? 0 : actualSvnTrunkBranchOrTagNumberPart;
  const sListURL = arrUrl.join('/').replace('"', '');
  let arrTagsOrBranchesSorted = [];
  let currentArrTagsOrBranchesSorted = [];
  let previousArrTagsOrBranchesSorted = [];
  const lsTagsOrBranches = await promises.svnListPromise(`"${sListURL}/${derivedSvnTrunkBranchOrTagPart}"`);
  // create array, only of numeric tags
  // eslint-disable-next-line no-restricted-globals
  const arrTagsOrBranches = lsTagsOrBranches.list.entry.filter((item) => !isNaN(item.name.charAt(0)));
  // properly order semantic tags on unfiltered arrTagsOrBranches
  if (arrTagsOrBranches.length > 1) {
    arrTagsOrBranchesSorted = arrTagsOrBranches.map((a) => a.name.replace(/\d+/g, (n) => +n + 100000)).sort().map((a) => a.replace(/\d+/g, (n) => +n - 100000));
  } else {
    // nothing to be sorted since there's only 1
    arrTagsOrBranchesSorted = arrTagsOrBranches;
  }
  // force trunk in sorted array
  arrTagsOrBranchesSorted.unshift('trunk');
  const indexCurrent = arrTagsOrBranchesSorted.findIndex((i) => i === derivedSvnTrunkBranchOrTagNumberPart);
  currentArrTagsOrBranchesSorted = arrTagsOrBranchesSorted[indexCurrent];
  if (tagNumberinPreviousSolution && tagNumberinPreviousSolution !== '') {
    previousArrTagsOrBranchesSorted = arrTagsOrBranchesSorted.find((e) => e === tagNumberinPreviousSolution);
  } else {
    previousArrTagsOrBranchesSorted = bSolutionOrComponentOnTrunk ? arrTagsOrBranchesSorted[arrTagsOrBranchesSorted.length - 1] : arrTagsOrBranchesSorted[indexCurrent - 1];
  }
  const currentResultInfo = await promises.svnInfoPromise(`"${url}"`);
  const currentRevisionNumber = currentResultInfo.entry.commit.$.revision;
  const currentTagNumber = bSolutionOrComponentOnTrunk ? 'trunk' : arrTagsOrBranches.find((i) => i.name === arrTagsOrBranchesSorted[indexCurrent]).name;
  const currentTagUrl = url;
  const currentTagBaseUrl = sListURL;
  const previousUrl = url.replace(currentArrTagsOrBranchesSorted, bSolutionOrComponentOnTrunk ? `${derivedSvnTrunkBranchOrTagPart}/` : '') + previousArrTagsOrBranchesSorted;
  const previousResultInfo = await promises.svnInfoPromise(`"${previousUrl}"`);
  const previousRevisionNumber = previousResultInfo.entry.commit.$.revision;
  const previousTagNumber = previousArrTagsOrBranchesSorted;
  const previousTagUrl = previousUrl;
  const previousTagBaseUrl = sListURL;
  const oReturnObject = {
    current: {
      tagNumber: currentTagNumber,
      tagRevisionNumber: currentRevisionNumber,
      tagUrl: currentTagUrl,
      tagBaseUrl: currentTagBaseUrl,
    },
    previous: {
      tagNumber: previousTagNumber,
      tagRevisionNumber: previousRevisionNumber,
      tagUrl: previousTagUrl,
      tagBaseUrl: previousTagBaseUrl,
    },
  };
  let future = {};
  oReturnObject.toBeTagged = false;
  if (bSolutionOrComponentOnTrunk) {
    const futureTagNumber = semver.inc(arrTagsOrBranchesSorted[arrTagsOrBranchesSorted.length - 1], 'minor');
    const futureTagUrl = previousTagUrl.replace(previousTagNumber, futureTagNumber);
    future = {
      tagNumber: futureTagNumber,
      tagUrl: futureTagUrl.replace('"', ''),
      tagBaseUrl: currentTagBaseUrl.replace('"', ''),
    };
    oReturnObject.future = future;
    oReturnObject.toBeTagged = true;
  }
  return oReturnObject;
}
module.exports = {
  getArrExternals,
  getSVNContext,
  getTag,
  svnOptions,
};

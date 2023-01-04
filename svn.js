const spawn = require('await-spawn');
const inquirer = require('inquirer');
const semver = require('semver');
const fs = require('fs');
// const { profile } = require('console');
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

function capitalizeWords(arr) {
  return arr.map((element) => element.charAt(0).toUpperCase() + element.slice(1).toLowerCase());
}

function parseSvnUsername(s) {
  const newS = s.trim().replace('ext-', '').replace('.', ' ');
  return capitalizeWords(newS.split(' ')).join(' ');
}

async function getAuthUser() {
  let sUserName = 'ext-unknown.user';
  if (!state.profile.svnOptionsUsername) {
    try {
      const bl = await spawn('svn', ['auth']);
      // eslint-disable-next-line prefer-destructuring
      sUserName = bl.toString().split('\r\n').filter((x) => x.includes('Username'))[0].split(':')[1];
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(e.stderr.toString());
    }
  } else {
    sUserName = state.profile.svnOptionsUsername;
  }
  return parseSvnUsername(sUserName);
}

async function getTagList(url) {
  const lsTags = await promises.svnListPromise(`"${url}/tags/"`);
  return lsTags;
}

async function getProbableSolution() {
  const cwd = process.cwd().toLowerCase();
  let probableSolution = '';
  if (clargs.argv.solution) {
    probableSolution = clargs.argv.solution;
  } else if ((fs.existsSync('./MBS Portal/.svn/'))) {
    const p = 'MBS Portal';
    const resultInfo = await promises.svnInfoPromise(`"${cwd}\\${p}"`, svnOptions);
    probableSolution = resultInfo.entry.url.split('/')[resultInfo.entry.url.split('/').indexOf('svn') + 1];
  } else if ((fs.existsSync('./MTS Portal/.svn/'))) {
    const p = 'MTS Portal';
    const resultInfo = await promises.svnInfoPromise(`"${cwd}\\${p}"`, svnOptions);
    probableSolution = resultInfo.entry.url.split('/')[resultInfo.entry.url.split('/').indexOf('svn') + 1];
  } else if ((fs.existsSync('./SC 2FA - specific/.svn/'))) {
    const p = 'SC 2FA - specific';
    const resultInfo = await promises.svnInfoPromise(`"${cwd}\\${p}"`, svnOptions);
    probableSolution = resultInfo.entry.url.split('/')[resultInfo.entry.url.split('/').indexOf('svn') + 1];
  } else {
    consoleLog.logNewLine('Solution could not be determined automatically. Please provide an --solution as argument.', 'gray');
    process.exit();
  }
  return probableSolution;
}

async function getSVNContext(app, workingCopyFolder, switchedTo) {
  let dirWithQuotedProjectName;
  let dir;
  let f;
  if (app === 'mts' || app === 'mbs') {
    dirWithQuotedProjectName = (`${workingCopyFolder}\\${JSON.stringify(`${app.toUpperCase()} Portal`)}`).replace(/[\\/]+/g, '/');// .replace(/^([a-zA-Z]+:|\.\/)/, '');
    dir = `.//${app.toUpperCase()} Portal`;
    f = `${state.app.toUpperCase()} Portal`;
  } else if (app === 'online') {
    dirWithQuotedProjectName = (`${workingCopyFolder}\\${JSON.stringify('SC 2FA - specific')}`).replace(/[\\/]+/g, '/');// .replace(/^([a-zA-Z]+:|\.\/)/, '');
    dir = './/SC 2FA - specific';
    f = 'SC 2FA - specific';
  }

  state.oAppContext.solution = await getProbableSolution();
  let appRoot = `https://svn.bearingpointcaribbean.com/svn/${state.oAppContext.solution}`;
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
      const bHasPrevious = (Object.prototype.hasOwnProperty.call(svnToVersionBranchesChoices, 'entry'));
      if (bHasPrevious) {
        qBranches = svnToVersionBranchesChoices.list.entry.filter((q) => !q.name.startsWith('cd_')).slice(-10).map((b) => 'branches/'.concat(b.name));
      } else qBranches = [];
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
        const url = `https://svn.bearingpointcaribbean.com/svn/${state.oAppContext.solution.toUpperCase()}/${answersToVersion.selectedSVNVersion}/${f}`;
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
  // if (tagNumberinPreviousSolution !== '') {
  //   derivedSvnTrunkBranchOrTagPart = 'tags';
  //   derivedSvnTrunkBranchOrTagNumberPart = tagNumberinPreviousSolution;
  // }
  const sListURL = arrUrl.join('/').replace('"', '');
  let arrTagsOrBranchesSorted = [];
  let currentArrTagsOrBranchesSorted = [];
  let previousArrTagsOrBranchesSorted = [];
  const lsTagsOrBranches = await promises.svnListPromise(`"${sListURL}/${derivedSvnTrunkBranchOrTagPart}"`);

  // bHasPrevious: consider solutions/components without previous tags or branches
  let bHasPrevious = Array.isArray(lsTagsOrBranches.list.entry);
  // (Object.prototype.hasOwnProperty.call(lsTagsOrBranches, 'list') ? Object.prototype.hasOwnProperty.call(lsTagsOrBranches.list.entry, 'length') : false);
  let arrTagsOrBranches;
  if (bHasPrevious) {
    // create array, only of numeric tags
    // eslint-disable-next-line no-restricted-globals
    arrTagsOrBranches = lsTagsOrBranches.list.entry.filter((item) => !isNaN(item.name.charAt(0)));
    // properly order semantic tags on unfiltered arrTagsOrBranches
    if (arrTagsOrBranches.length > 1) {
      arrTagsOrBranchesSorted = arrTagsOrBranches.map((a) => a.name.replace(/\d+/g, (n) => +n + 100000)).sort().map((a) => a.replace(/\d+/g, (n) => +n - 100000));
    } else {
      // nothing to be sorted since there's only 1
      bHasPrevious = false;
      arrTagsOrBranchesSorted = arrTagsOrBranches;
    }
  }
  // force trunk in sorted array
  arrTagsOrBranchesSorted.unshift('trunk');
  const indexCurrent = arrTagsOrBranchesSorted.findIndex((i) => i === derivedSvnTrunkBranchOrTagNumberPart);
  currentArrTagsOrBranchesSorted = arrTagsOrBranchesSorted[indexCurrent];

  let componentPrevious;
  let solutionPrevious;
  let previousTagNumber;
  let previousTagUrl;
  let previousTagBaseUrl;

  let previousUrl; let previousResultInfo; let previousRevisionNumber; let
    previousRelativeUrl;

  // previous component and component in previous solution
  if (tagNumberinPreviousSolution && tagNumberinPreviousSolution !== '') {
    previousArrTagsOrBranchesSorted = arrTagsOrBranchesSorted.find((e) => e === tagNumberinPreviousSolution);
    if (bHasPrevious) {
      previousUrl = url.replace(currentArrTagsOrBranchesSorted, bSolutionOrComponentOnTrunk ? `${derivedSvnTrunkBranchOrTagPart}/` : '') + previousArrTagsOrBranchesSorted;
      previousResultInfo = await promises.svnInfoPromise(`"${previousUrl}"`);
      previousRevisionNumber = previousResultInfo.entry.commit.$.revision;
      previousTagNumber = previousArrTagsOrBranchesSorted;
      previousRelativeUrl = previousResultInfo.entry['relative-url'].replaceAll('^/', '');
      previousTagUrl = previousUrl;
      previousTagBaseUrl = sListURL;

      solutionPrevious = {
        tagNumber: previousTagNumber,
        relativeUrl: previousRelativeUrl,
        tagRevisionNumber: previousRevisionNumber,
        tagUrl: previousTagUrl,
        tagBaseUrl: previousTagBaseUrl,
      };
    }
  }

  // eslint-disable-next-line no-nested-ternary
  previousArrTagsOrBranchesSorted = bSolutionOrComponentOnTrunk ? (tagNumberinPreviousSolution !== '' ? tagNumberinPreviousSolution : arrTagsOrBranchesSorted[arrTagsOrBranchesSorted.length - 1]) : arrTagsOrBranchesSorted[indexCurrent - 1];

  if (bHasPrevious) {
    previousUrl = url.replace(currentArrTagsOrBranchesSorted, bSolutionOrComponentOnTrunk ? `${derivedSvnTrunkBranchOrTagPart}/` : '') + previousArrTagsOrBranchesSorted;
    previousResultInfo = await promises.svnInfoPromise(`"${previousUrl}"`);
    previousRevisionNumber = previousResultInfo.entry.commit.$.revision;
    previousTagNumber = previousArrTagsOrBranchesSorted;
    previousRelativeUrl = previousResultInfo.entry['relative-url'].replaceAll('^/', '');
    previousTagUrl = previousUrl;
    previousTagBaseUrl = sListURL;

    componentPrevious = {
      tagNumber: previousTagNumber,
      relativeUrl: previousRelativeUrl,
      tagRevisionNumber: previousRevisionNumber,
      tagUrl: previousTagUrl,
      tagBaseUrl: previousTagBaseUrl,
    };
  }

  const currentResultInfo = await promises.svnInfoPromise(`"${url}"`);
  const currentRevisionNumber = currentResultInfo.entry.commit.$.revision;
  const currentTagNumber = bSolutionOrComponentOnTrunk ? 'trunk' : arrTagsOrBranches.find((i) => i.name === arrTagsOrBranchesSorted[indexCurrent]).name;
  const currentRelativeUrl = currentResultInfo.entry['relative-url'].replaceAll('^/', '');
  const currentTagUrl = url;
  const currentTagBaseUrl = sListURL;

  const oReturnObject = {
    current: {
      tagNumber: currentTagNumber,
      relativeUrl: currentRelativeUrl,
      tagRevisionNumber: currentRevisionNumber,
      tagUrl: currentTagUrl,
      tagBaseUrl: currentTagBaseUrl,
    },
    solutionPrevious,
    previous: componentPrevious,
  };
  let future = {};
  oReturnObject.toBeTagged = false;

  let futureTagNumber;
  let futureTagUrl;

  if (bSolutionOrComponentOnTrunk) {
    if (bHasPrevious) {
      // the replace is to check it numeric except for period char, so 1.11.2_new becomes 1.11.2
      futureTagNumber = semver.inc(arrTagsOrBranchesSorted[arrTagsOrBranchesSorted.length - 1].replace(/[^0-9.]/g, ''), 'minor');
      futureTagUrl = previousTagUrl.replace(previousTagNumber, futureTagNumber);
    } else {
      futureTagNumber = '1.0';
      futureTagUrl = currentTagUrl.replace('trunk', `${derivedSvnTrunkBranchOrTagPart}/${futureTagNumber}`);
    }
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
  getAuthUser,
  getProbableSolution,
  getSVNContext,
  getTag,
  svnOptions,
  getTagList,
};

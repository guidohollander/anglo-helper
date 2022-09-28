/* eslint-disable no-console */
const inquirer = require('inquirer');
const crypto = require('crypto');
const fs = require('fs');
const promises = require('./promises');
const consoleLog = require('./consoleLog');
const state = require('./state');
const teams = require('./teams');

inquirer.registerPrompt('search-list', require('inquirer-search-list'));

function getAllIndexes(arr, val) {
  const indexes = []; let i;
  for (i = 0; i < arr.length; i += 1) { if (arr[i].includes(val)) indexes.push(i); }
  return indexes;
}

async function updateExternal(arr, componentName, searchVal, replaceVal) {
  const indexes = getAllIndexes(arr, componentName);
  // eslint-disable-next-line no-restricted-syntax
  for await (const iExternal of indexes) {
    const oldString = arr[iExternal];
    // eslint-disable-next-line no-param-reassign
    arr[iExternal] = arr[iExternal].replaceAll(searchVal, replaceVal);
    console.log(`Updated from ${oldString} to ${arr[iExternal]}`);
  }
  return arr;
}

async function perform(arr) {
  const oarrQ = arr.filter((e) => e.isExternal && e.isTagged && e.isCoreComponent);
  const arrQ = Object.values(oarrQ).map((i) => ({ value: i, name: `${i.key} [${i.relativeUrl}]` }));

  if (!state.oSolution.current.relativeUrl === 'trunk') consoleLog('Warning!! Your repository is not pointing towards the trunk!', 'red');
  await inquirer
    .prompt([
      {
        type: 'search-list',
        message: 'Search and select solution component to switch to trunk',
        name: 'selectedComponent',
        choices: arrQ,
      },
      {
        type: 'boolean',
        message: (question) => `Are you sure you want to switch '${question.selectedComponent.key}' from ${question.selectedComponent.relativeUrl} to trunk?`,
        name: 'areyousure',
        default: true,
      },
      {
        type: 'input',
        message: 'Optionally specify a JIRA issue. It will be registered in the svn commit and anglo-helper teams messages.',
        name: 'jiraIssue',
      },
    ])
    .then(async (answers) => {
      const svnOptions = { trustServerCert: true };
      let fMod;
      try {
        if (answers.areyousure) {
          const oExternals = await promises.svnPropGetPromise('svn:externals', state.oSVNInfo.remoteRepo, svnOptions);
          const externals = oExternals.target.property._.split('\r\n');
          let updatedExternals = await updateExternal(externals, answers.selectedComponent.key, answers.selectedComponent.relativeUrl, 'trunk');
          updatedExternals = updatedExternals.join('\r\n');
          fMod = `ext_mod_${crypto.randomBytes(8).toString('hex')}`;
          fs.writeFileSync(fMod, updatedExternals);
          const svnCommand = `svnmucc propsetf svn:externals ${fMod} ${state.oSVNInfo.remoteRepo} -m "${answers.jiraIssue ? answers.jiraIssue : ''} auto update external ${answers.selectedComponent.key} from ${answers.selectedComponent.relativeUrl} to trunk"`;
          // await util.execShellCommand(svnCommand);
          fs.unlinkSync(fMod);
          await teams.postMessageToTeams('anglo-helper --componentToTrunk', `${state.app.toUpperCase()}: ${answers.selectedComponent.key} from ${answers.selectedComponent.relativeUrl} to trunk ${answers.jiraIssue ? `[${answers.jiraIssue}]` : ''}`);
        }
      } catch (error) {
        console.dir(error);
      }
    });
}
module.exports = {
  perform,
};

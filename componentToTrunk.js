/* eslint-disable no-console */
const inquirer = require('inquirer');
const crypto = require('crypto');
const fs = require('fs');
// const { array } = require('yargs');
const util = require('./util');
const promises = require('./promises');
const consoleLog = require('./consoleLog');
const state = require('./state');
const teams = require('./teams');
const subTaskSwitch = require('./subTask_switch');

inquirer.registerPrompt('search-list', require('inquirer-search-list'));

function getAllIndexes(arr, val) {
  const indexes = []; let i;
  for (i = 0; i < arr.length; i += 1) { if (arr[i].includes(val)) indexes.push(i); }
  return indexes;
}

async function updateExternal(arrComponents, arrExternals, componentName, searchVal, replaceVal) {
  const arrUpdatedComponentEntries = [];
  const indexes = getAllIndexes(arrExternals, componentName);
  // eslint-disable-next-line no-restricted-syntax
  for await (const iExternal of indexes) {
    const oldString = arrExternals[iExternal];
    // eslint-disable-next-line no-param-reassign
    arrExternals[iExternal] = arrExternals[iExternal].replaceAll(searchVal, replaceVal);
    console.log(`Updated from ${oldString} to ${arrExternals[iExternal]}`);
    // match updated external from file with component, so we know which one to switch
    const matchingComponentEntry = arrComponents.find((component) => decodeURI(oldString.split(' ')[0]) === component.path);
    arrUpdatedComponentEntries.push(matchingComponentEntry);
  }
  return {
    externals: arrExternals.join('\r\n'),
    updateComponentEntries: arrUpdatedComponentEntries,
  };
}

// provide 1 or more
async function replaceAndWrite(answers,from, to) {
  const svnOptions = { trustServerCert: true };
  const oExternals = await promises.svnPropGetPromise('svn:externals', state.oSVNInfo.remoteRepo, svnOptions);
  const externals = oExternals.target.property._.split('\r\n');
  const oUpdatedExternals = await updateExternal(answers.componentSelector.componentCollection, externals, answers.componentSelector.selectedComponent.key, answers.componentSelector.selectedComponent.relativeUrl, 'trunk');
  const fMod = `ext_mod_${crypto.randomBytes(8).toString('hex')}`;
  fs.writeFileSync(fMod, oUpdatedExternals.externals);
  const svnCommand = `svnmucc propsetf svn:externals ${fMod} ${state.oSVNInfo.remoteRepo} -m "${answers.jiraIssue ? answers.jiraIssue : ''} auto update external ${answers.componentSelector.selectedComponent.key} from ${answers.componentSelector.selectedComponent.relativeUrl} to trunk"`;
  await util.execShellCommand(svnCommand);
  fs.unlinkSync(fMod);
  return oUpdatedExternals;
}

async function perform(arr, from, to) {
  if (Array.isArray(arr)) {
    const oarrQ = arr.filter((e) => e.isExternal && e.isTagged && e.isCoreComponent);
    const arrQ = Object.values(oarrQ).map((i) => ({ value: { selectedComponent: i, componentCollection: arr }, name: `${i.key} [${i.relativeUrl}]` }));

    if (!state.oSolution.current.relativeUrl === 'trunk') consoleLog('Warning!! Your repository is not pointing towards the trunk!', 'red');
    await inquirer
      .prompt([
        {
          type: 'search-list',
          message: 'Search and select solution component to switch to trunk',
          name: 'componentSelector',
          choices: arrQ,
        },
        {
          type: 'boolean',
          message: (question) => `Are you sure you want to switch '${question.componentSelector.selectedComponent.key}' from ${question.componentSelector.selectedComponent.relativeUrl} to trunk?`,
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
        try {
          if (answers.areyousure) {
            const oUpdatedExternals = await replaceAndWrite(answers);
            await teams.postMessageToTeams('anglo-helper --componentToTrunk', `${state.app.toUpperCase()}: ${answers.componentSelector.selectedComponent.key} from ${answers.componentSelector.selectedComponent.relativeUrl} to trunk ${answers.jiraIssue ? `[${answers.jiraIssue}]` : ''}`);
            // eslint-disable-next-line no-restricted-syntax
            for await (const componentEntry of oUpdatedExternals.updateComponentEntries) {
              await subTaskSwitch.perform(componentEntry);
            }
          }
        } catch (error) {
          console.dir(error);
        }
      });
  } else {
    await replaceAndWrite(arr,from, to);
  }
}
module.exports = {
  perform,
};

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
const clargs = require('./arguments');

const svnOptions = { trustServerCert: true };

inquirer.registerPrompt('search-list', require('inquirer-search-list'));

function getAllIndexes(arr, val) {
  const indexes = []; let i;
  for (i = 0; i < arr.length; i += 1) { if (arr[i].includes(val)) indexes.push(i); }
  return indexes;
}



async function writeExternals(sExternals, componentToTrunkAnswers) {
  const fMod = `ext_mod_${crypto.randomBytes(8).toString('hex')}`;
  fs.writeFileSync(fMod, sExternals);
  let commitMessage;
  if (componentToTrunkAnswers) {
    commitMessage = `[${componentToTrunkAnswers.jiraIssue ? componentToTrunkAnswers.jiraIssue : ''}]: auto update external ${componentToTrunkAnswers.componentSelector.selectedComponent.key} from ${componentToTrunkAnswers.componentSelector.selectedComponent.relativeUrl} to trunk`;
  } else {
    commitMessage = 'Auto update externals';
  }
  const svnCommand = `svnmucc propsetf svn:externals ${fMod} ${state.oSVNInfo.remoteRepo} -m "${commitMessage}"`;
  await util.execShellCommand(svnCommand);
  fs.unlinkSync(fMod);
}

async function updateExternal(arrComponents, arrExternals, componentName, searchVal, replaceVal) {
  const arrUpdatedComponentEntries = [];
  const indexes = getAllIndexes(arrExternals, componentName);
  // eslint-disable-next-line no-restricted-syntax
  for await (const iExternal of indexes) {
    const oldString = arrExternals[iExternal];
    // eslint-disable-next-line no-param-reassign
    arrExternals[iExternal] = arrExternals[iExternal].replaceAll(searchVal, replaceVal);
    console.log(`Updated ${oldString.split('\'')[1]}`);
    // match updated external from file with component, so we know which one to switch
    const matchingComponentEntry = arrComponents.find((component) => decodeURI(oldString.split(' ')[0].toLowerCase()) === component.path.toLowerCase());
    arrUpdatedComponentEntries.push(matchingComponentEntry);
  }
  return {
    externals: arrExternals.join('\r\n'),
    updateComponentEntries: arrUpdatedComponentEntries,
  };
}

// provide 1 or more
async function replaceAndWriteExternalsComponentToTrunk(answers) {
  const oExternals = await promises.svnPropGetPromise('svn:externals', state.oSVNInfo.remoteRepo, svnOptions);
  const externals = oExternals.target.property._.split('\r\n');
  const oUpdatedExternals = await updateExternal(answers.componentSelector.componentCollection, externals, answers.componentSelector.selectedComponent.key, answers.componentSelector.selectedComponent.relativeUrl, 'trunk');
  await writeExternals(oUpdatedExternals.externals, answers);
  return oUpdatedExternals;
}

async function replaceAndWriteExternals(arrChanges) {
  const oExternals = await promises.svnPropGetPromise('svn:externals', state.oSVNInfo.remoteRepo, svnOptions);
  let externalsFileContent = oExternals.target.property._; // .replaceAll(/(?:\\[rn]|[\r\n]+)+/g, '\n');
  fs.writeFileSync('./externals_before.json', externalsFileContent);
  consoleLog.logNewLine('', 'white');
  consoleLog.logNewLine('updating externals', 'white');
  arrChanges.forEach((item) => {
    const from = `/${item.component}/${item.from}`;
    const to = `/${item.component}/${item.to}`;
    const regExFindReplace = new RegExp(from, 'gi');
    externalsFileContent = externalsFileContent.replaceAll(regExFindReplace, to);
    consoleLog.logNewLine(`${from} => ${to}`, 'white');
  });
  if (!clargs.argv.dryRun) {
    await writeExternals(externalsFileContent);
  }
}

async function perform(arr) {
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
          const oUpdatedExternals = await replaceAndWriteExternalsComponentToTrunk(answers);
          // await teams.postMessageToTeams('anglo-helper --componentToTrunk', `${state.app.toUpperCase()} ${state.oSVNInfo.angloClient} ${state.oSVNInfo.angloSVNPath}: ${answers.componentSelector.selectedComponent.key} from ${answers.componentSelector.selectedComponent.relativeUrl} to trunk ${answers.jiraIssue ? `[${answers.jiraIssue}]` : ''}`);
          // eslint-disable-next-line no-restricted-syntax
          for await (const componentEntry of oUpdatedExternals.updateComponentEntries) {
            await subTaskSwitch.perform(componentEntry);
          }
        }
      } catch (error) {
        console.dir(error);
      }
    });
}

module.exports = {
  perform,
  replaceAndWriteExternals,
};

// const argreplaceAndWriteExternalsComponentToTrunk = [];
// argreplaceAndWriteExternalsComponentToTrunk.push({ component: answers.componentSelector.selectedComponent.bareComponentName, from: answers.componentSelector.selectedComponent.relativeUrl, to: 'trunk' });

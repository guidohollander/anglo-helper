#!/usr/bin/env node
const clear = require('clear');
const fs = require('fs');
const inquirer = require('inquirer');
const readline = require('readline');

const path = require('path');
const xlsx = require('xlsx');// npm install xlsx

const anglo = require('./anglo');
const clargs = require('./arguments');
const consoleLog = require('./consoleLog');
const db = require('./db');
const promises = require('./promises');
const state = require('./state');
// const subTaskCheckSpecifics = require('./subTask_checkSpecifics');
const subTaskDeploymentCheck = require('./subTask_deploymentCheck');
const subTaskCompareSpecific = require('./subTask_compareSpecific');
const subTaskFlyway = require('./subTask_flyway');
const subTaskSelect = require('./subTask_select');
const subTaskClone = require('./subTask_clone');
const subTaskSwitch = require('./subTask_switch');
const subTaskTagReport = require('./subTask_tagReport');
const subTaskTagReportExecution = require('./subTask_tagReportExecution');
// const subTaskGenerateMarkdown = require('./subTask_generateMarkdown');
const subTaskUpdate = require('./subTask_update');
const svn = require('./svn');
const comsclient = require('./coms');
const pjson = require('./package.json');
const componentToTrunk = require('./subTask_componentToTrunk');
const util = require('./util');
const { oAppContext } = require('./state');

// app context
state.oAppContext = anglo.getProbableApp();
state.oAppContext.solution = svn.getProbableSolution();
state.oAppContext.version = pjson.version;
state.oAppContext.name = pjson.name;
state.oAppContext.descriptiveName = pjson.descriptivename;
state.app = state.oAppContext.app;
state.workingCopyFolder = anglo.getWorkingCopyFolder(state.oAppContext);
function getComponentName(componentBaseFolder) {
  const p1 = componentBaseFolder.split('/');
  const fullComponentName = (p1[p1.length - 2].replaceAll('_', ' ').includes('SolutionDevelopment') ? 'SC ' : 'DSC ') + p1[p1.length - 1].replaceAll('_', ' ').replace('Compliance', 'Compliancy').replace('SC Reallocate Payment', 'SC Payment reallocation');
  const bareComponentName = p1[p1.length - 1];
  return { fullComponentName, bareComponentName };
}
function catchKeyPress() {
  if (!clargs.argv.componentToTrunk && !clargs.argv.componentsToTrunk && !clargs.argv.componentToTag && !clargs.argv.select && !clargs.argv.clone) { // only allow during regular, long-running entry (component / project) based operations
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) { process.stdin.setRawMode(true); }
    process.stdin.on('keypress', (chunk, key) => {
      if (key && key.name === 'v') {
        state.profile.verbose = !state.profile.verbose; // toggle
      }
      if (key && key.name === 'f') {
        state.profile.flyway = !state.profile.flyway; // toggle
      }
      if (key && key.name === 'u') {
        state.profile.autoUpdate = !state.profile.autoUpdate; // toggle
      }
      if (key && key.name === 's') {
        state.profile.autoSwitch = !state.profile.autoSwitch; // toggle
      }
      if (key.ctrl && key.name === 'c') {
        process.exit();
      }
      if (key && key.name === 'a') { // toggle all
        const toggle = !state.profile.autoUpdate;
        state.profile.autoSwitch = toggle; // [S]
        state.profile.autoUpdate = toggle; // [U]
        state.profile.flyway = toggle; // [F]
      }
      if (key && key.name === 'x') {
        process.exit();
      }
    });
  }
}
function replaceSVNVersion(entry, t) {
  let retval = t;
  // const spacer = ' ';
  if (state.profile.supportUnicodeChars) {
    // const prefix = entry.isInternal ? '[i] ' : '[x] ';
    // retval = prefix.concat(t);
    retval = retval.split('/');
    // if (retval.length > 1) {
    //   retval[0] = retval[0];
    //   retval[1] = spacer.repeat(6 - retval[1].length);
    // }
    retval = retval.join('/');
    return retval.replace('tags/', '🏷/'.replace('trunk', '🪵 ')).replace('branches/', 'b/');
  }
  return retval;
}
function getSvnInfo(entry) {
  let retVal = '';
  if (state.profile.verbose && !entry.isFrontend) {
    // internal
    if (entry.isInternal && (entry.isTrunk)) {
      retVal = `${replaceSVNVersion(entry, 'trunk')}`;
    }
    if (entry.isInternal && (entry.isTagged)) {
      retVal = `${replaceSVNVersion(entry, state.oSVNInfo.currentVersion)}`;
    }
    if (entry.isInternal && (entry.isBranched)) {
      retVal = `${replaceSVNVersion(entry, state.oSVNInfo.currentVersion)}`;
    }
    // external
    if (entry.isExternal && entry.isTrunk) {
      retVal = `${replaceSVNVersion(entry, 'trunk')}`;
    }
    if (entry.isExternal && entry.isTagged) {
      retVal = `${replaceSVNVersion(entry, entry.relativeUrl)}`;
    }
    if (entry.isExternal && entry.isBranched) {
      retVal = `${replaceSVNVersion(entry, entry.relativeUrl)}`;
    }
    retVal = `[${retVal}]`;
  }
  return retVal;
}
async function main() {
  // const commandHandlers = clargs.getCommandHandlers();
  // if (!clargs.argv._[0] || !(clargs.argv._[0] in commandHandlers)) {
  //   throw new Error('Must provide a valid command');
  // }

  try {
    // if provided, add username and password to the svn options
    if (state.profile.svnOptionsUsername && state.profile.svnOptionsPassword) {
      svn.svnOptions.username = state.profile.svnOptionsUsername;
      svn.svnOptions.password = state.profile.svnOptionsPassword;
    }
    // handle command line switch to state.profile overrides
    if (clargs.argv.switch) state.profile.autoSwitch = clargs.argv.switch;
    if (clargs.argv.update) state.profile.autoUpdate = clargs.argv.update;
    if (clargs.argv.flyway && state.profile.flywayPath) {
      // toggle other profile items off when explicitly setting flyway switch
      state.profile.flyway = clargs.argv.flyway;
      state.profile.autoSwitch = false;
      state.profile.autoUpdate = false;
      state.profile.compareSpecific = false;
      state.profile.flyway = clargs.argv.flyway;
    }
    if (clargs.argv.flywayValidateOnly || clargs.argv.flywayValidateOnly) state.profile.verbose = true;
    if (clargs.argv.compare && state.profile.compareSpecificRootFolder) {
      state.profile.compareSpecific = clargs.argv.compare;
      state.profile.autoSwitch = false;
      state.profile.autoUpdate = false;
      state.profile.flyway = false;
    }
    if (clargs.argv.verbose) state.profile.verbose = clargs.argv.verbose;
    if (clargs.argv.tagReport || clargs.argv.tagReportExecution || clargs.argv.deploymentCheck || clargs.argv.checkSpecifics) {
      state.profile.autoSwitch = false;
      state.profile.autoUpdate = false;
      state.profile.flyway = false;
      state.profile.compareSpecific = false;
      state.profile.verbose = true;
    }
    if (clargs.argv.select) {
      state.profile.autoSwitch = true;
      state.profile.autoUpdate = true;
    }
    if (clargs.argv.generateMarkdown) { // toggle other profile items off when explicitly setting flyway switch
      state.profile.flyway = clargs.argv.flyway;
      state.profile.autoSwitch = false;
      state.profile.autoUpdate = false;
      state.profile.compareSpecific = false;
      state.profile.flyway = false;
    }
    // gather information about current solution for the tag report
    // eslint-disable-next-line global-require, import/no-dynamic-require
    state.arrSolutions = require(`${path.dirname(state.workingCopyFolder)}/.anglo-helper/solutions.json`);
    state.currentSolution = state.arrSolutions.find((s) => s.name === state.oSVNInfo.svnApp);

    // state.oSVNInfo.remoteRepo = 'https://svn.blyce.com/svn/MTS_ANGUILLA/tags/2.0.0';
    state.oSolution = await svn.getTag(`${state.oSVNInfo.remoteRepo}`, clargs.argv.solutionFrom);
    state.prettySVNUsername = await svn.getAuthUser();

    // comsclient.client.publish(`${comsclient.mqttTopic}${state.currentSolution.customerCode}`, JSON.stringify(`{implementation: '${state.currentSolution.customerCode}', user: '${state.prettySVNUsername}}'`, null, '\t'));

    // implicitly enable checkSpecifics when update is set to true in profile
    if (state.profile.autoUpdate && state.oSolution.current.relativeUrl === 'trunk') {
      clargs.argv.checkSpecifics = true;
    }
    state.startingTime = Date.now();
    let arrAll = [];
    await consoleLog.showHeader();
    // check and if necessary create solution profile in parent folder
    let fn = `${path.dirname(state.workingCopyFolder)}/.anglo-helper`;
    if (!fs.existsSync(fn)) {
      fs.mkdirSync(fn);
    }
    const solutionsProfileFileName = path.normalize(`${fn}/solutions.json`);
    if (!fs.existsSync(solutionsProfileFileName)) {
      fs.writeFileSync(solutionsProfileFileName, JSON.stringify(state.arrSolutions, null, 2));
    } else {
      // check the contents / paths in the existing solutions.json file
      // eslint-disable-next-line no-restricted-syntax
      for await (const sol of state.arrSolutions) {
        if (sol.path && !fs.existsSync(sol.path)) {
          // eslint-disable-next-line no-console
          console.log(`The location ${sol.path} as specified in ${fn}/solutions.json does not exist. Please update or empty the path for each solution trunk`);
          process.exit(1);
        }
      }
    }
    // get externals
    consoleLog.logNewLine('', 'gray');
    consoleLog.logNewLine(`getting externals from current solution ${state.oSolution.current.relativeUrl} [rev:${state.oSolution.current.tagRevisionNumber}]`, 'gray');
    state.arrSVNExternalsCurrentSolutionTag = await svn.getArrExternals(state.oSolution.current.tagUrl);
    if (clargs.argv.tagReport && !clargs.argv.generateMarkdown) {
      if (state.oSolution.previous) {
        consoleLog.logNewLine(`getting externals from previous solution tags/${state.oSolution.previous.tagNumber} [rev:${state.oSolution.previous.tagRevisionNumber}]`, 'gray');
        state.arrSVNExternalsPreviousSolutionTag = await svn.getArrExternals(state.oSolution.previous.tagUrl); // oPreviousSolutionTag.tagUrl
        consoleLog.logNewLine(`determine difference between ${state.oSolution.previous.relativeUrl} and ${state.oSolution.current.relativeUrl} rev:{${state.oSolution.previous.tagRevisionNumber}:${state.oSolution.current.tagRevisionNumber}}`, 'gray');
      }
      // // difference
      // state.arrSVNExternalsPreviousSolutionTag = [];
      state.arrExt = state.arrSVNExternalsCurrentSolutionTag.filter((x) => !state.arrSVNExternalsPreviousSolutionTag.includes(x));
      // intersection: result can be used as filter on internals since we want ALL internals except for the ones that correspond with unmodified tagged components
      state.arrIntFilter = state.arrSVNExternalsCurrentSolutionTag.filter((x) => state.arrSVNExternalsPreviousSolutionTag.includes(x));
      if (clargs.argv.writeJsonFiles) {
        fs.writeFileSync('./current_externals_raw.json', JSON.stringify(state.arrSVNExternalsCurrentSolutionTag, null, 2));
        fs.writeFileSync('./previous_externals_raw.json', JSON.stringify(state.arrSVNExternalsPreviousSolutionTag, null, 2));
        fs.writeFileSync('./externals_difference_raw.json', JSON.stringify(state.arrExt, null, 2));
        fs.writeFileSync('./externals_insersection_raw.json', JSON.stringify(state.arrIntFilter, null, 2));
      }
      state.arrIntFilter.forEach((entry) => {
        const tidied = anglo.tidyArrayContent(entry);
        if (tidied.name !== '') {
          state.arrInternalsFilter.push({
            key: tidied.name,
          });
        }
      });
    } else {
      state.arrExt = state.arrSVNExternalsCurrentSolutionTag;
    }
    state.arrSVNExternalsPreviousSolutionTag.forEach((entry) => {
      const tidied = anglo.tidyArrayContent(entry);
      if (tidied.name !== '') {
        state.arrPreviousExternals.push({
          key: tidied.name,
          path: decodeURI(tidied.path),
          version: entry.split('/')[entry.split('/').length - 2],
        });
      }
    });

    if (clargs.argv.checkSpecifics) {
      const relevantSolutions = state.arrSolutions.filter((s) => s.class === 'MxS');
      // eslint-disable-next-line no-restricted-syntax
      for await (const sol of relevantSolutions) {
        sol.externals = await svn.getArrExternals(sol.url);
        sol.tidiedexternals = [];
        sol.externals.forEach((entry) => {
          const tidied = anglo.tidyArrayContent(entry);
          // for componentBaseFolder. If domain-specific, keep first 3, else keep first 4 parts
          const partsToKeep = (tidied.name.toLowerCase().startsWith('dsc')) ? 4 : 5;
          if (tidied.name !== '') {
            const component = getComponentName(decodeURI(tidied.path.split('/').slice(0, partsToKeep).join('/')).replace('//', '/'));

            sol.tidiedexternals.push({
              key: tidied.name,
              path: decodeURI(tidied.path),
              componentBaseFolder: decodeURI(tidied.path.split('/').slice(0, partsToKeep).join('/')).replace('//', '/'),
              componentRoot: state.oSVNInfo.baseURL + decodeURI(tidied.path.split('/').slice(0, partsToKeep).join('/')).replace('//', '/').replace(component.bareComponentName, '').replace(/^\//, ''),
              componentName: component.fullComponentName,
              bareComponentName: component.bareComponentName,
              relativeUrl: tidied.path.replaceAll(`${decodeURI(tidied.path.split('/').slice(0, partsToKeep).join('/')).replace('//', '/')}/`, '').split('/').slice(0, -1).join('/')
                .split('/')
                .splice(-2)
                .join('/'),
              isExternal: true,
              isCoreComponent: !tidied.name.toLowerCase().includes('interface def'),
              isInterfaceDefinition: tidied.name.toLowerCase().includes('interface def'),
              isSpecific: tidied.name.toLowerCase().includes('specific'),
              isDomainSpecific: tidied.name.toLowerCase().startsWith('dsc'),
              isSolutionComponent: tidied.name.toLowerCase().startsWith('sc'),
              isTagged: decodeURI(tidied.path).toLocaleLowerCase().includes('/tags/'),
              isBranched: decodeURI(tidied.path).toLocaleLowerCase().includes('/branches/'),
              isTrunk: decodeURI(tidied.path).toLocaleLowerCase().includes('/trunk/'),
              isFrontend: tidied.name === 'FRONTEND',
            });
          }
        });
      }
    }

    const arrExternals = [];
    state.arrExt.forEach((entry) => {
      const tidied = anglo.tidyArrayContent(entry);
      // for componentBaseFolder. If domain-specific, keep first 3, else keep first 4 parts
      const partsToKeep = (tidied.name.toLowerCase().startsWith('dsc')) ? 4 : 5;
      if (tidied.name !== '') {
        const component = getComponentName(decodeURI(tidied.path.split('/').slice(0, partsToKeep).join('/')).replace('//', '/'));
        arrExternals.push({
          key: tidied.name,
          path: decodeURI(tidied.path),
          componentBaseFolder: decodeURI(tidied.path.split('/').slice(0, partsToKeep).join('/')).replace('//', '/'),
          componentRoot: state.oSVNInfo.baseURL + decodeURI(tidied.path.split('/').slice(0, partsToKeep).join('/')).replace('//', '/').replace(component.bareComponentName, '').replace(/^\//, ''),
          componentName: component.fullComponentName,
          bareComponentName: component.bareComponentName,
          relativeUrl: tidied.path.replaceAll(`${decodeURI(tidied.path.split('/').slice(0, partsToKeep).join('/')).replace('//', '/')}/`, '').split('/').slice(0, -1).join('/')
            .split('/')
            .splice(-2)
            .join('/'),
          isExternal: true,
          isCoreComponent: !tidied.name.toLowerCase().includes('interface def'),
          isInterfaceDefinition: tidied.name.toLowerCase().includes('interface def'),
          isSpecific: tidied.name.toLowerCase().includes('specific'),
          isDomainSpecific: tidied.name.toLowerCase().startsWith('dsc'),
          isSolutionComponent: tidied.name.toLowerCase().startsWith('sc'),
          isTagged: decodeURI(tidied.path).toLocaleLowerCase().includes('/tags/'),
          isBranched: decodeURI(tidied.path).toLocaleLowerCase().includes('/branches/'),
          isTrunk: decodeURI(tidied.path).toLocaleLowerCase().includes('/trunk/'),
          isFrontend: tidied.name === 'FRONTEND',
        });
      }
    });
    if (clargs.argv.writeJsonFiles) {
      fs.writeFileSync('./externals.json', JSON.stringify(arrExternals, null, 2));
    }
    // get internals
    const lsInternals = await svn.getInternals(state.oSolution.current.tagUrl);
    const arrInternals = [];
    consoleLog.logNewLine('getting internals', 'gray');
    lsInternals.list.entry.forEach((entry) => {
      const internalEntry = {
        key: entry.name,
        path: `${state.oSVNInfo.svnAndApp + state.oSVNInfo.repo}/${state.oSVNInfo.angloSVNPath}/${entry.name}`,
        componentBaseFolder: `${state.oSVNInfo.svnAndApp + state.oSVNInfo.repo}/${state.oSVNInfo.angloSVNPath}/${entry.name}`,
        componentRoot: state.oSVNInfo.appRoot,
        isInternal: true,
        isCoreComponent: false,
        isInterfaceDefinition: false,
        isFrontend: false,
        isSpecific: entry.name.toLowerCase().includes('specific'),
        isDomainSpecific: entry.name.toLowerCase().startsWith('dsc'),
        isSolutionComponent: entry.name.toLowerCase().startsWith('sc'),
        componentName: entry.name,
        bareComponentName: entry.name,
        isTagged: decodeURI(state.oSVNInfo.URL).toLocaleLowerCase().includes('tags'),
        isBranched: decodeURI(state.oSVNInfo.URL).toLocaleLowerCase().includes('branches'),
        isTrunk: decodeURI(state.oSVNInfo.URL).toLocaleLowerCase().includes('trunk'),
      };
      arrInternals.push(internalEntry);
      // delete entry.$;
      // delete entry.commit;
      // delete Object.assign(entry, { key: entry.name }).name;
      // entry.isInternal = true;
      // entry.isCoreComponent = false;
      // entry.isInterfaceDefinition = false;
      // entry.isSpecific = entry.key.toLowerCase().includes('specific');
      // entry.isDomainSpecific = entry.key.toLowerCase().startsWith('dsc');
      // entry.isSolutionComponent = entry.key.toLowerCase().startsWith('sc');
      // entry.path = `${state.oSVNInfo.svnAndApp + state.oSVNInfo.repo}/${state.oSVNInfo.angloSVNPath}/${entry.key}`;
      // entry.componentName = entry.key;
      // entry.componentBaseFolder = `${state.oSVNInfo.svnAndApp + state.oSVNInfo.repo}/${state.oSVNInfo.angloSVNPath}/${entry.key}`;
      // entry.isTagged = decodeURI(entry.path).toLocaleLowerCase().includes('/tags/');
      // entry.isBranched = decodeURI(entry.path).toLocaleLowerCase().includes('/branches/');
      // entry.isTrunk = decodeURI(entry.path).toLocaleLowerCase().includes('/trunk/');
    });
    arrInternals.filter((x) => state.arrInternalsFilter.find((y) => (y.key !== x.key.replace(/ - specific/ig, ''))));
    if (clargs.argv.writeJsonFiles) {
      fs.writeFileSync('./internals.json', JSON.stringify(arrInternals, null, 2));
    }
    // combine external and interal arrays, but filter empty elements
    arrAll = arrExternals.concat(arrInternals);
    // tagreportexecution: limit the projects to those stored in the tagreport
    if (clargs.argv.tagReportExecution) {
      fn = clargs.argv.tagReportExecution;
      if (fs.existsSync(path.normalize(state.workingCopyFolder + fn))) {
        // eslint-disable-next-line global-require, import/no-dynamic-require
        state.tagReportArray = require(path.normalize(state.workingCopyFolder + fn));
      }
      arrAll = arrAll.filter((x) => state.tagReportArray[0].componentCollection.find((y) => (y.component === x.componentName)));
    }
    // inherit exclude json from app project and store locally if not exists
    let excludeArray = [];
    if (!fs.existsSync(`${state.workingCopyFolder}/exclude.json`)) {
      // eslint-disable-next-line global-require
      excludeArray = require('./exclude.json');
      fs.writeFileSync('./exclude.json', JSON.stringify(excludeArray, null, 2));
    } else {
      // load local exclude list
      // eslint-disable-next-line import/no-dynamic-require, global-require
      excludeArray = require(`${state.workingCopyFolder}/exclude.json`);
    }
    // apply to combined array
    arrAll = arrAll.filter((project) => !excludeArray.includes(project.key));
    // inherit include json from app project and store locally if not exists
    let includeArray = [];
    if (!fs.existsSync(`${state.workingCopyFolder}/include.json`)) {
      // eslint-disable-next-line global-require
      includeArray = require('./include.json');
      fs.writeFileSync('./include.json', JSON.stringify(includeArray, null, 2));
    } else {
      // load local include list
      // eslint-disable-next-line import/no-dynamic-require, global-require
      includeArray = require(`${state.workingCopyFolder}/include.json`);
      // concat the keepup list so only the keepup list applies for this run
      const keepUpFile = `${state.workingCopyFolder}keepUp.json`;
      if (clargs.argv.keepUp && fs.existsSync(keepUpFile)) {
        // eslint-disable-next-line import/no-dynamic-require, global-require
        const keepupArray = require(keepUpFile);
        if (keepupArray.length > 0) {
          includeArray = includeArray.concat(keepupArray);
          state.profile.autoUpdate = true;
        }
      }
    }
    if (includeArray.length > 1) {
      arrAll = arrAll.filter((project) => includeArray.includes(project.key));
    }
    if (clargs.argv.component) {
      arrAll = arrAll.filter((project) => project.key.toLowerCase().includes(clargs.argv.component.toLowerCase()));
    }
    arrAll.sort((a, b) => a.key.localeCompare(b.key));
    anglo.moveComponent(arrAll);
    if (clargs.argv.writeJsonFiles) {
      fs.writeFileSync('./all.json', JSON.stringify(arrAll, null, 2));
    }
    let progressCounter = 1;
    await util.findBeInformedProcess();
    const actions = [];
    if (!clargs.argv.tagReport && !clargs.argv.tagReportExecution) { actions.push('   [M]issing project detection'); }
    if (state.profile.autoSwitch && state.beInformedRunning) { actions.push('   [Š]witch detection'); }
    if (state.profile.autoSwitch && !state.beInformedRunning) { actions.push('   [S]witch'); }
    if (state.profile.autoUpdate && state.beInformedRunning) { actions.push('   [Ŭ]pdate detection'); }
    if (state.profile.autoUpdate && !state.beInformedRunning) { actions.push('   [U]pdate'); }
    if (state.profile.flyway && !(clargs.argv.flywayValidateOnly || clargs.argv.flywayRepairOnly) && !state.profile.flywayReplaceVariables) { actions.push('   [F]lyway'); }
    if (state.profile.flyway && (clargs.argv.flywayValidateOnly || clargs.argv.flywayRepairOnly) && !state.profile.flywayReplaceVariables) { actions.push('   [F]lyway val/rep only'); }
    if (state.profile.flyway && !(clargs.argv.flywayValidateOnly || clargs.argv.flywayRepairOnly) && state.profile.flywayReplaceVariables) { actions.push('   [F]lyway (+vr)'); }
    if (state.profile.flyway && (clargs.argv.flywayValidateOnly || clargs.argv.flywayRepairOnly) && state.profile.flywayReplaceVariables) { actions.push('   [F]lyway val/rep only (+vr)'); }
    if (state.profile.compareSpecific) { actions.push('   [C]ompare specific'); }
    if (clargs.argv.deploymentCheck) { actions.push('   [D]eployment check'); }
    if (clargs.argv.checkSpecifics) { actions.push('   [P]Check sPecifics'); }
    if (clargs.argv.tagReport) { actions.push('   [T]ag report'); }
    if (clargs.argv.tagReportExecution) { actions.push('   [T]ag report execution'); }
    consoleLog.showBIRunningWarning(state.beInformedRunning);
    // render capabilities
    if (actions.length > 0) {
      consoleLog.logNewLine('', 'gray');
      consoleLog.logNewLine('actions legend: ', 'gray');
    }
    actions.forEach((action) => {
      // consoleLog.logNewLine(action, 'gray');
      consoleLog.logNewLine(' '.repeat(action.length - 2) + consoleLog.giveSpace(action, ' ') + action, 'cyan');
    });
    consoleLog.showLegend();
    consoleLog.logNewLine('', 'gray');
    const lengthLongestProjectNameMap = (key, array) => Math.max(...array.map((a) => a[key].length));
    const lengthLongestProjectName = (lengthLongestProjectNameMap('key', /* in */ arrAll));
    const spacer = '∙';
    let dir;
    // loop all folder in arrAll
    const bEntryAction = !clargs.argv.componentToTrunk && !clargs.argv.componentsToTrunk && !clargs.argv.componentToTag;

    if (bEntryAction) {
      // eslint-disable-next-line no-restricted-syntax
      for await (const entry of arrAll) {
        // if startRow or startProject have been set: start from there, otherwise start from the first
        if ((progressCounter >= clargs.argv.startRow) && (entry.key.toLowerCase() >= clargs.argv.startProject.toLowerCase())) {
          // consoleLog.logThisLine(`${consoleLog.getProgressString(progressCounter, arrAll.length)} ${entry.key}`, 'gray');
          // consoleLog.logThisLine(` ${spacer.repeat(130 - lengthLongestProjectName - entry.key.length)}`, 'gray');
          consoleLog.logThisLine(`${consoleLog.getProgressString(progressCounter, arrAll.length)} ${entry.key}`, 'gray');
          consoleLog.logThisLine(` ${spacer.repeat(140 - lengthLongestProjectName - entry.key.concat(getSvnInfo(entry)).length - 1)}${getSvnInfo(entry)}> `, 'gray');
          dir = anglo.unifyPath(state.workingCopyFolder) + entry.key;
          const dirWithQuotedProjectName = anglo.unifyPath(state.workingCopyFolder) + JSON.stringify(entry.key);
          if (fs.existsSync(dir)) {
            entry.found = true;
            entry.path = entry.path.replace(/^\//, ''); // remove leading / from path if necessary
            const componentContinuousDeliveryFolder = `${dir}/_CONTINUOUS_DELIVERY/DATABASE_MIGRATIONS/`;
            entry.componentContinuousDeliveryFolderFound = (fs.existsSync(componentContinuousDeliveryFolder));
            entry.generalContinuousDeliveryFolderFound = (entry.key === '_CONTINUOUS_DELIVERY');
            entry.local_path = dir;
            const resultInfo = await promises.svnInfoPromise(dirWithQuotedProjectName, svn.svnOptions);
            entry.svninfo = resultInfo;
            entry.local_project_repo = state.oSVNInfo.baseURL + entry.path;
            // const switchPath = !entry.isFrontend ? state.oSVNInfo.baseURL + entry.path : entry.path;
            const switchPath = state.oSVNInfo.baseURL + entry.path;
            entry.match = (switchPath.toLowerCase() === decodeURI(resultInfo.entry.url).toLowerCase());

            // if component is on trunk, check if latest log entry is a tag action
            // if (entry.isTrunk && entry.isExternal) {
            //   const logList = await promises.svnLogPromise(`${entry.componentBaseFolder}`, svn.svnOptions);
            //   let logListEntries = logList.logentry;
            //   if (logListEntries && logListEntries.length > 0) {
            //     console.log(logListEntries);
            //   }
            // }

            // switch if autoswtich enabled local and remote do not match
            if (state.profile.autoSwitch && (!entry.isInternal || clargs.argv.select)) {
              await subTaskSwitch.perform(entry);
            } else {
              // [S] not enabled
            }
            // update if autoUpdate enabled
            if (state.profile.autoUpdate && (entry.isTrunk || entry.isBranched || (entry.isTagged && entry.isSpecific) || clargs.argv.select)) {
              await subTaskUpdate.perform(entry);
            } else {
              // [U] not enabled
            }
            // perform db migrations if flyway enabled and current project has a migration folder (component or general)
            if (state.profile.flyway) {
              await subTaskFlyway.perform(entry);
            } else {
              // flyway not enabled
            }
            // compare specific folder with reference specific
            if (state.profile.compareSpecific) {
              await subTaskCompareSpecific.perform(entry);
            } else {
              // compareSpecific not enabled
            }
            // perform deployment check on project
            if (clargs.argv.deploymentCheck) {
              await subTaskDeploymentCheck.perform(entry);
            } else {
              // deploymentCheck not enabled
            }
            // perform check of specifics files
            if (clargs.argv.checkSpecifics) {
              // await subTaskCheckSpecifics.perform(entry);
            } else {
              // checkSpecifics not enabled
            }
            // create a jira tag report for each component
            if (clargs.argv.tagReport) {
              await subTaskTagReport.perform(entry);
            } else {
              // tagReport not enabled
            }
            if (clargs.argv.tagReportExecution) {
              await subTaskTagReportExecution.performComponent(entry);
            } // tagReport exectuion not enabled
            if (clargs.argv.generateMarkdown) {
              // await subTaskGenerateMarkdown.performComponent(entry, state.arrTagReportCollection.find((s) => s.bareComponentName === entry.bareComponentName));
            } // generateMarkdown not enabled
          } else if (!clargs.argv.tagReport && !clargs.argv.tagReportExecution) {
            anglo.memorable('[M]', state.arrMissingCollection, entry, state.oSVNInfo.baseURL + entry.path.replace(/^\//, '').key, 'green');
            dir = state.workingCopyFolder + entry.key;
            const url = state.oSVNInfo.baseURL + entry.path.replace(/^\//, ''); // remove leading / from path if necessary
            const execCommand = `svn checkout "${url}" "${dir}" --non-interactive`;
            try {
              await util.execShellCommand(execCommand);
            } catch (error) {
              // eslint-disable-next-line no-console
              console.dir('Errors while executing:', execCommand);//
              util.beep(3);
            }
          }
          consoleLog.logNewLine('', 'gray');
        }
        progressCounter += 1;
      }
    } else if (clargs.argv.componentToTrunk) {
      await componentToTrunk.performTagToTrunk(arrAll);
    } else if (clargs.argv.componentsToTrunk) {
      await componentToTrunk.performSetOfTagsToTrunk(arrAll);
    } else if (clargs.argv.componentToTag) {
      await componentToTrunk.performTrunkToTag(arrAll);
    }
    if (clargs.argv.tagReportExecution) {
      // to update all externals to the newly created tags
      await subTaskTagReportExecution.batchUpdateExternals();
      await subTaskTagReportExecution.performSolution();
    }
    if (clargs.argv.generateMarkdown) {
      // await subTaskGenerateMarkdown.performImplementation(state, arrAll, state.arrTagReportCollection);
      // await subTaskGenerateMarkdown.performCustomer(state);
    } // generateMarkdown not enabled

    const SummaryCount = (state.arrMissingCollection.length + state.arrSwitchUpdateCollection.length + state.arrSVNUpdatedCollection.length + state.arrFlywayUpdatedCollection.length + state.arrCompareSpecificUpdateCollection.length + state.arrSVNPotentialUpdateCollection.length + state.arrDeploymentCheckCollection.length + state.arrTagReportCollection.length + state.arrUnlinkedFolderCollection.length);
    if (SummaryCount > 0) {
      state.exitCode = 1;
      consoleLog.logNewLine('', 'gray');
      // eslint-disable-next-line no-console
      console.log('Summary:', SummaryCount.toString().trim(), `(potential) updates for ${state.app}`);
      util.beep(2);
    } else {
      consoleLog.logNewLine('', 'gray');
      consoleLog.logNewLine('Summary: ', 'gray');
      consoleLog.logNewLine(`No significant updates for ${state.app}`, 'gray');
    }
    if (state.arrMissingCollection.length > 0) {
      consoleLog.logNewLine(`${state.arrMissingCollection.length} [M]issing project(s): Add repo location(s) below and choose "Import / General / Existing Projects into workspace" in Be Informed Studio`, 'red');
    }
    // eslint-disable-next-line no-restricted-syntax
    for (const entry of state.arrMissingCollection) {
      consoleLog.logNewLine(`* ${entry}`, 'green');
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const entry of state.arrSwitchUpdateCollection) {
      consoleLog.logNewLine(`SVN [S]witch: ${entry}`, 'green');
    }
    if (state.arrSwitchUpdateCollection.length > 0) {
      consoleLog.logNewLine(`${state.arrSwitchUpdateCollection.length} [S]witched project(s) require a refresh / rebuild / validate in Be Informed.`, 'red');
    }
    // eslint-disable-next-line no-restricted-syntax
    for (const entry of state.arrSVNUpdatedCollection) {
      consoleLog.logNewLine(`SVN [U]pdate: ${entry}`, 'green');
    }
    if (state.arrSVNUpdatedCollection.length > 0) {
      consoleLog.logNewLine(`${state.arrSVNUpdatedCollection.length} [U]pdated project(s) require a refresh / rebuild / validate in Be Informed.`, 'red');
    }
    // eslint-disable-next-line no-restricted-syntax
    for (const entry of state.arrFlywayUpdatedCollection) {
      consoleLog.logNewLine(`[F]lyway: ${entry}`, 'gray');
    }
    // eslint-disable-next-line no-restricted-syntax
    for (const entry of state.arrSVNPotentialUpdateCollection) {
      consoleLog.logNewLine(`Potential [Ŭ]pdates: ${entry}`, 'cyan');
    }

    // stats
    state.endingTime = Date.now();
    consoleLog.logNewLine('', 'gray');
    consoleLog.logNewLine('Stats:', 'gray');
    const date = new Date(state.endingTime);
    consoleLog.logNewLine(`${date.toDateString()} ${date.getHours()}:${date.getMinutes()} / runtime: ${util.diffSeconds(new Date(state.startingTime), new Date(state.endingTime))} seconds`, 'gray');

    // store potential updates, so user can update the projects after closing bi using the --keepUp. After an actual update, empty
    const keepUpFilename = `${state.workingCopyFolder}keepup.json`;
    if (state.arrSVNPotentialUpdateCollection.length > 0) {
      fs.writeFileSync(keepUpFilename, JSON.stringify(state.arrSVNPotentialUpdateCollection, null, 2));
    }
    if (state.profile.autoUpdate && !state.beInformedRunning && fs.existsSync(keepUpFilename && state.arrSVNPotentialUpdateCollection.length === 0)) {
      // remove keepup file in next regular updates
      fs.unlinkSync(keepUpFilename);
    }
    if (state.arrCompareSpecificUpdateCollection.length > 0) {
      consoleLog.logNewLine(`${state.arrCompareSpecificUpdateCollection.length} project for which the [C]ompare specific check failed. Manually investigate the inconsistencies.`, 'red');
    }
    if (state.arrDeploymentCheckCollection.length > 0) {
      consoleLog.logNewLine(`${state.arrDeploymentCheckCollection.length} project for which the [D]eployment check failed. Tag the relevant externals projects.`, 'red');
    }
    // eslint-disable-next-line no-restricted-syntax
    for (const entry of state.arrUnlinkedFolderCollection) {
      consoleLog.logNewLine(`[D]eleted folder caused by SVN [S]witch error: ${entry}`, 'green');
    }
    if (state.arrUnlinkedFolderCollection.length > 0) {
      consoleLog.logNewLine(`${state.arrUnlinkedFolderCollection.length} [D]eleted folders caused by SVN [S]witch error. Run anglo-helper --keepUp to add missing project(s)`, 'red');
    }
    if (state.arrDeploymentCheckCollection.length === 0 && clargs.argv.deploymentCheck) {
      consoleLog.logNewLine('Deployment check positive: all externals have been tagged.', 'green');
    }
    if (clargs.argv.tagReport && state.arrTagReportCollection.length > 0) {
      const issueCount = state.arrTagReportCollection.map((a) => a.jiraIssues.length).reduce((a, b) => a + b);
      state.arrTagReportSolutionCollection.push({
        solution: state.currentSolution.name,
        toBeTagged: state.oSolution.toBeTagged,
        previousSolutionTagNumber: state.oSolution.previous ? state.oSolution.previous.tagNumber : 'N/A',
        previousSolutionTagRevisionNumber: state.oSolution.previous ? state.oSolution.previous.tagRevisionNumber : 1,
        currentSolutionTagNumber: state.oSolution.current.tagNumber,
        currentSolutionTagRevisionNumber: state.oSolution.current.tagRevisionNumber,
        solutionTagName: Object.prototype.hasOwnProperty.call(state.oSolution, 'future') ? `${state.currentSolution.functionalName} ${state.oSolution.future.tagNumber}` : `${state.currentSolution.functionalName} ${state.oSolution.current.tagNumber}`,
        solutionTagNumber: Object.prototype.hasOwnProperty.call(state.oSolution, 'future') ? state.oSolution.future.tagNumber : state.oSolution.current.tagNumber,
        solutionTagBaseUrl: state.oSolution.current.tagBaseUrl,
        solutionTagSourceUrl: state.oSolution.current.tagUrl,
        solutionTagTargetUrl: Object.prototype.hasOwnProperty.call(state.oSolution, 'future') ? state.oSolution.future.tagUrl : state.oSolution.current.tagNumber,
        numberOfComponents: state.arrTagReportCollection.length,
        numberOfJiraIssues: issueCount,
        componentCollection: state.arrTagReportCollection,
      });
      const filenameEnvironmentPart = state.oSVNInfo.remoteRepo.substring(state.oSVNInfo.remoteRepo.indexOf('/svn/') + 5).replaceAll('/', '_').replaceAll('.', '_').toLowerCase();
      const tagReportFilename = `${state.workingCopyFolder}tagreport_${filenameEnvironmentPart}${clargs.argv.component ? `_component_${clargs.argv.component}` : ''}`;
      if (state.arrTagReportCollection && state.arrTagReportCollection.length > 0 && issueCount && issueCount > 0) {
        consoleLog.logNewLine(`Tag report has been stored as ${tagReportFilename}.json. It contains ${state.arrTagReportCollection.length} components and ${issueCount} issues`, 'gray');
      }
      // write (append to new or existing file)
      fs.writeFileSync(`${tagReportFilename}.json`, JSON.stringify(state.arrTagReportSolutionCollection, null, 2));
      const newWB = xlsx.utils.book_new();
      const excelProjectArray = state.arrTagReportCollection.map(({
        jiraProjects, jiraIssues, wasAlreadyTagged, isMajor, ...keepAttrs
      }) => keepAttrs);
      const objProject = excelProjectArray.map((e) => e);
      try {
        const newWSProject = xlsx.utils.json_to_sheet(objProject);
        const excelJiraArray = state.arrOverallJiraCollection.map(({ commitMessages, ...keepAttrs }) => keepAttrs);
        const objIssue = excelJiraArray.map((e) => e);
        const newWSIssue = xlsx.utils.json_to_sheet(objIssue);
        xlsx.utils.book_append_sheet(newWB, newWSProject, 'components');
        xlsx.utils.book_append_sheet(newWB, newWSIssue, 'issues');
        xlsx.writeFile(newWB, `${tagReportFilename}.xlsx`);// file name as param
      } catch (error) {
        // eslint-disable-next-line no-console
        console.dir('Errors while exporting to excel. Is file closed?');
        util.beep(3);
      }
    }
    consoleLog.showBIRunningWarning(state.beInformedRunning);
  } catch (error) {
    // console.log(error)
    // eslint-disable-next-line no-console
    console.log('Errors occurred:', error);//
    util.beep(3);
  }
  process.stdout.write('\n');

  process.exit(state.exitCode);
}
async function prequal() {
  let sequenceNumber = await anglo.getProfileSequenceNumber();
  let isFirstTimeUse;
  if (sequenceNumber === 0) {
    isFirstTimeUse = true;
    sequenceNumber = 1;
  }

  catchKeyPress();

  // svn context
  state.oSVNInfo = await svn.getSVNContext(state.app, state.workingCopyFolder);
  if (isFirstTimeUse || !clargs.argv.clone === '') {
    consoleLog.renderTitle();
    const questions = [
      {
        type: 'confirm',
        name: 'autoSwitch',
        message: 'SVN: Would you like to automatically [S]witch to the correct external locations? ',
        default: true,
      },
      {
        type: 'confirm',
        name: 'autoUpdate',
        message: 'SVN: Would you like to automatically [U]pdate your project folders? ',
        default: true,
      },
      {
        type: 'input',
        name: 'svnOptionsUsername',
        default: clargs.argv.svnOptionsUsername,
        message: "SVN: Optionally provide your SVN user name. It's usually in the format 'xxx.xxxx' or 'ext-xxx.xxxx', for example 'ext-jane.doe' ",
        when: (answers) => answers.autoSwitch || answers.autoUpdate,
      },
      {
        type: 'input',
        name: 'svnOptionsPassword',
        default: clargs.argv.svnOptionsPassword,
        message: 'SVN: Please provide your SVN password. ',
        when: (answers) => answers.svnOptionsUsername && (answers.autoSwitch || answers.autoUpdate),
      },
      {
        type: 'input',
        name: 'jiraUsername',
        default: clargs.argv.jiraUsername,
        message: 'Jira: Provide your JIRA user name.',
        when: () => clargs.argv.enableJiraIntegration,
      },
      {
        type: 'input',
        name: 'jiraPassword',
        default: clargs.argv.jiraPassword,
        message: 'Jira: Please provide your JIRA password. ',
        when: (answers) => clargs.argv.enableJiraIntegration || answers.jiraUsername,
      },
      {
        type: 'confirm',
        name: 'flyway',
        message: `Flyway: ${state.oAppContext.descriptiveName} is able to execute general and component-level Flyway scripts. Would you like to enable [F]lyway integration? `,
        default: true,
      },
      {
        type: 'input',
        name: 'flywayPath',
        default: 'c:/fw/',
        message: "Flyway: Please provide the path to the folder where the Flyway binary (flyway) resides. Use forward slashes, for example 'c:/fw/' ",
        when: (answers) => answers.flyway,
      },
      {
        type: 'input',
        name: 'flywayDatabaseServer',
        default: 'localhost',
        message: `Flyway: To store Flyway history, ${state.oAppContext.descriptiveName} needs information about the database server. On which machine (or host) is the SQL Server running. Most likely, this is 'localhost' `,
        when: (answers) => answers.flyway,
      },
      {
        type: 'input',
        name: 'flywayDatabaseServerPort',
        default: '1433',
        message: 'Flyway: By default, SQL Server runs on port 1433. Just press enter if that is the case, otherwise provide an alternate port number ',
        when: (answers) => answers.flyway,
      }, {
        type: 'input',
        name: 'flywayDatabaseName',
        default: `aia_${state.app}`,
        message: `Flyway: In which database should Flyway register its history? For example 'aia_${state.app}' `,
        when: (answers) => answers.flyway,
      },
      {
        type: 'confirm',
        name: 'flywayDatabaseIntegratedSecurity',
        default: true,
        message: 'Flyway: Use integrated security for database authentication? ',
        when: (answers) => answers.flyway,
      },
      {
        type: 'input',
        name: 'flywayDatabaseUsername',
        default: 'sa',
        message: `Flyway: What database user can ${state.oAppContext.descriptiveName} use to access the database? For example 'sa' `,
        when: (answers) => answers.flyway && !answers.flywayDatabaseIntegratedSecurity,
      },
      {
        type: 'input',
        name: 'flywayDatabasePassword',
        default: '1',
        message: `Flyway: What database password can ${state.oAppContext.descriptiveName} use to access the database? Default: '1' `,
        when: (answers) => answers.flyway && !answers.flywayDatabaseIntegratedSecurity,
      },
      {
        type: 'confirm',
        name: 'compareSpecific',
        message: `Specific compare: ${state.oAppContext.descriptiveName} can [C]ompare your specific projects with specific projects in another repository. Would you like to enable this feature? `,
        default: false,
      },
      {
        type: 'input',
        name: 'compareSpecificRootFolder',
        default: `d:/repo/${state.app}/`,
        message: `Specific compare: Please provide the path to the root of another workspace folder. Use forward slashes, for example 'd:/repo/${state.app}/'`,
        when: (answers) => answers.compareSpecific,
      },
      {
        type: 'confirm',
        name: 'verbose',
        message: `Verbose output: ${state.oAppContext.descriptiveName} can output more detailed process information, for example about (potential) SVN updates, flyway operations and specific comparisons. Would you like to enable this feature? `,
        default: true,
      }];
    inquirer
      .prompt(questions)
      .then((answers) => {
        if (db.checkdb(answers)) {
          const profileFilename = `${state.workingCopyFolder}profile_${sequenceNumber}.json`;
          // workaround: if password contains problematic characters then remove svn username and password. User then has to login once, manually
          if ((answers.svnOptionsUsername && answers.svnOptionsUsername.includes('"')) || (answers.svnOptionsPassword && answers.svnOptionsPassword.includes('"'))) {
            // eslint-disable-next-line no-param-reassign
            delete answers.svnOptionsUsername;
            // eslint-disable-next-line no-param-reassign
            delete answers.svnOptionsPassword;
          }
          fs.writeFileSync(profileFilename, JSON.stringify(answers, null, 2));
          consoleLog.logNewLine('', 'gray');
          consoleLog.logNewLine(`Your profile has been stored as ${profileFilename}. ${state.oAppContext.descriptiveName} will now continue its operation with this profile.`, 'gray');
          consoleLog.logNewLine('', 'gray');
          state.profile = answers;
          state.profile.filename = profileFilename;
          main();
        } else {
          // eslint-disable-next-line no-console
          console.log('Unable to access database');
          util.beep(3);
          process.exit(state.exitCode);
        }
      })
      .catch((error) => {
        if (error.isTtyError) {
          // eslint-disable-next-line no-console
          console.log('Your console environment is not supported!');
        } else {
          // eslint-disable-next-line no-console
          console.dir(error);
        }
      });
  } else if (clargs.argv.select) {
    await subTaskSelect.perform();
    main();
  } else if (clargs.argv.clone) {
    await subTaskClone.perform();
    process.exit(state.exitCode);
  } else {
    if (Object.prototype.hasOwnProperty.call(clargs.argv, 'profile') && (clargs.argv.profile.length > 0)) {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      state.profile = require(path.normalize(state.workingCopyFolder + clargs.argv.profile));
      state.profile.filename = clargs.argv.profile;
    } else {
      const fn = 'profile_1.json';
      // eslint-disable-next-line import/no-dynamic-require, global-require
      state.profile = require(path.normalize(state.workingCopyFolder + fn));
      state.profile.filename = fn;
    }
    main();
  }
  // perform action related checks
  if ((clargs.argv.tagReport) && (!state.profile.jiraUsername || !state.profile.jiraUsername)) {
    // eslint-disable-next-line no-console
    console.log('Specify jiraUsername / jiraUsername in active profile or as command line argument');
    process.exit(state.exitCode);
  }
}
clear();
prequal();

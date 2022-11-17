/* eslint-disable no-console */
const { dirname } = require('path');
const fs = require('fs');
const path = require('path');
const anglo = require('./anglo');
const clargs = require('./arguments');
const consoleLog = require('./consoleLog');
const promises = require('./promises');
const state = require('./state');
const svn = require('./svn');
const util = require('./util');

async function updateVariablesInSqlFiles(componentEntry, location) {
  const migrationsDestination = location.replace('filesystem:', '');
  if (fs.existsSync(migrationsDestination)) {
    // try {
    const appDir = dirname(require.main.filename);
    const normalizePathToMergeScript = path.normalize(`${appDir}\\merge.ps1`);
    const execCommand = `powershell.exe -file "${normalizePathToMergeScript}" "${state.workingCopyFolder + state.profile.flywayReplaceVariablesPropFile}" "${migrationsDestination}"`;
    console.log('command:', execCommand);
    await util.execShellCommand(execCommand);
    // } catch (error) {
    //   console.dir('Errors while executing updating variables in flyway sql files: ', location);
    //   util.beep(3);
    //   process.exit(1);
    // }
  } else {
    console.log('migrationsDestination does not exist');
  }
}

async function checkUncommittedChanges(componentEntry) {
  let uncommittedChanges = false;
  if (state.profile.flywayReplaceVariables) {
    if (state.workingCopyFolder + state.profile.flywayReplaceVariablesPropFile) {
      if (fs.existsSync(state.workingCopyFolder + state.profile.flywayReplaceVariablesPropFile)) {
        const dirWithQuotedProjectName = anglo.unifyPath(state.workingCopyFolder) + JSON.stringify(componentEntry.key);
        const mergeList = await promises.svnStatusPromise(dirWithQuotedProjectName, svn.svnOptions);
        if (mergeList.target.entry) {
          uncommittedChanges = JSON.stringify(mergeList.target.entry.$).includes('_CONTINUOUS_DELIVERY');
        }
      } else {
        console.log('flywayVariableReplacementPropFile does not exist');
      }
    } else {
      console.log('flywayVariableReplacementPropFile not set in profile!');
    }
  }
  return uncommittedChanges;
}

async function revertChanges(dir) {
  if (state.profile.flywayReplaceVariables) {
    if (state.workingCopyFolder + state.profile.flywayReplaceVariablesPropFile) {
      if (fs.existsSync(state.workingCopyFolder + state.profile.flywayReplaceVariablesPropFile)) {
        const revertSvnOptions = JSON.parse(JSON.stringify(svn.svnOptions));
        revertSvnOptions.params = ['--recursive'];
        const revertList = await promises.svnRevertPromise(dir, revertSvnOptions);
        if (revertList) {
          consoleLog.logThisLine(' variable replacements reverted', 'gray');
          // consoleLog.logNewLine('', 'gray');
          // consoleLog.logNewLine('', 'gray');
          // consoleLog.logNewLine(revertList.replace(/^--- Reverted .*/m, ''), 'yellow');
        }
      } else {
        console.log('flywayVariableReplacementPropFile does not exist');
      }
    } else {
      console.log('flywayVariableReplacementPropFile not set in profile!');
    }
  }
}

async function perform(componentEntry) {
  // set default flyway action to migrate
  let flywayAction = 'migrate';
  const dir = anglo.unifyPath(state.workingCopyFolder) + componentEntry.key;
  const dirWithQuotedProjectName = anglo.unifyPath(state.workingCopyFolder) + JSON.stringify(componentEntry.key);
  // override default when command line option flywayValidateOnly is set
  if (clargs.argv.flywayValidateOnly) flywayAction = 'validate'; // instead of migrate
  const flywayDatabaseTable = '__MigrationsHistory';
  const flywayDatabaseSchema = 'migrations';
  if (componentEntry.componentContinuousDeliveryFolderFound || componentEntry.generalContinuousDeliveryFolderFound) {
    // in case of flywayReplaceVariables: check for any uncommitted files beforehand, since all potential changes will be reverted when variables are replaced
    const uncommittedChanges = await checkUncommittedChanges(componentEntry);
    if (!uncommittedChanges) {
      let flywayTable;
      let FlywayDir;
      let FlywayDirWithQuotedProjectName;
      let suffix;
      let flywayLocations;
      if (componentEntry.generalContinuousDeliveryFolderFound) {
        flywayTable = JSON.stringify(flywayDatabaseTable);
        suffix = '/_GENERAL/DATABASE_MIGRATIONS/';
        FlywayDir = `${dir}${suffix}`;
        FlywayDirWithQuotedProjectName = `${dirWithQuotedProjectName}/_GENERAL/DATABASE_MIGRATIONS/`;
        flywayLocations = JSON.stringify(`filesystem:${FlywayDir}`);
      } else {
        flywayTable = JSON.stringify(componentEntry.key);
        suffix = '/_CONTINUOUS_DELIVERY/DATABASE_MIGRATIONS/';
        FlywayDir = `${dir}${suffix}`;
        FlywayDirWithQuotedProjectName = `${dirWithQuotedProjectName}/_CONTINUOUS_DELIVERY/DATABASE_MIGRATIONS/`;
        flywayLocations = JSON.stringify(`filesystem:${FlywayDir}`);
      }
      const flywayDatabaseConnectionString = `jdbc:sqlserver://${state.profile.flywayDatabaseServer}:${state.profile.flywayDatabaseServerPort};databaseName=${state.profile.flywayDatabaseName};integratedSecurity=${state.profile.flywayDatabaseIntegratedSecurity ? 'true' : 'false'};`;
      let credentialsString = '';
      if (!state.profile.flywayDatabaseIntegratedSecurity) {
        credentialsString = `-user=${state.profile.flywayDatabaseUsername} -password=${state.profile.flywayDatabasePassword}`;
      }
      const flywayCommand = `"${state.profile.flywayPath}flyway" ${flywayAction} -color=always -locations=${flywayLocations} -schemas=${flywayDatabaseSchema} -table=${flywayTable} -url=${flywayDatabaseConnectionString} ${credentialsString}`;
      await updateVariablesInSqlFiles(componentEntry, FlywayDir);
      let flywayResult = await util.execShellCommand(flywayCommand);
      flywayResult = flywayResult.replace(/^Database: .*\(Microsoft SQL Server [\d]+\.[\d]+\)/m, '');
      flywayResult = flywayResult.replace(/^Flyway Community Edition .*/m, '');
      flywayResult = flywayResult.replace(/^Current version of schema .*/m, '');
      flywayResult = flywayResult.trim();
      if (flywayResult.includes('No migration necessary')) {
        consoleLog.logThisLine('[F]', 'gray');
      } else {
        anglo.memorable('[F]', state.arrFlywayUpdatedCollection, componentEntry, flywayResult, 'green');
        if (state.profile.verbose) {
          consoleLog.logNewLine('', 'white');
          consoleLog.logNewLine('', 'white');
          consoleLog.logNewLine(flywayResult, 'gray');
        }
      }
      await revertChanges(FlywayDirWithQuotedProjectName);
    } else {
      consoleLog.logNewLine(`[F] skipped - uncommitted changes found`, 'red');
    }
  } else {
    // flyway enabled, but no continuous delivery folder
  }
}
module.exports = {
  perform,
};

const anglo = require('./anglo');
const clargs = require('./arguments');
const consoleLog = require('./consoleLog');
const state = require('./state');
const util = require('./util');

async function perform(componentEntry) {
  // set default flyway action to migrate
  let flywayAction = 'migrate';
  const dir = anglo.unifyPath(state.workingCopyFolder) + componentEntry.key;
  // override default when command line option flywayValidateOnly is set
  if (clargs.argv.flywayValidateOnly) flywayAction = 'validate'; // instead of migrate
  const flywayDatabaseTable = '__MigrationsHistory';
  const flywayDatabaseSchema = 'migrations';
  if (componentEntry.componentContinuousDeliveryFolderFound || componentEntry.generalContinuousDeliveryFolderFound) {
    let flywayTable;
    let flywayLocations;
    if (componentEntry.generalContinuousDeliveryFolderFound) {
      flywayTable = JSON.stringify(flywayDatabaseTable);
      flywayLocations = JSON.stringify(`filesystem:${dir}/_GENERAL/DATABASE_MIGRATIONS/`);
    } else {
      flywayTable = JSON.stringify(componentEntry.key);
      flywayLocations = JSON.stringify(`filesystem:${dir}/_CONTINUOUS_DELIVERY/DATABASE_MIGRATIONS/`);
    }
    const flywayDatabaseConnectionString = `jdbc:sqlserver://${state.profile.flywayDatabaseServer}:${state.profile.flywayDatabaseServerPort};databaseName=${state.profile.flywayDatabaseName};integratedSecurity=${state.profile.flywayDatabaseIntegratedSecurity};`;
    let credentailsString = '';
    if (!state.profile.flywayDatabaseIntegratedSecurity) {
      credentailsString = `-user=${state.profile.flywayDatabaseUsername} -password=${state.profile.flywayDatabasePassword}`;
    }
    const flywayCommand = `"${state.profile.flywayPath}flyway" ${flywayAction} -color=always -locations=${flywayLocations} -schemas=${flywayDatabaseSchema} -table=${flywayTable} -url=${flywayDatabaseConnectionString} ${credentailsString}`;
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
  } else {
    // flyway enabled, but no continuous delivery folder
  }
}
module.exports = {
  perform,
};

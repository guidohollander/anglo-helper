const yargs = require('yargs');

module.exports = {
  argv: yargs
    .option('app', {
      describe: 'choose an app',
      choices: ['mbs', 'mts'],
    })
    .option('domain', {
      describe: 'your company domain. It will be used as domain for svn and jira urls. Do not prefix with protocol info, like https:// and also do not use slashes. Example: microsoft.com or myorganisation.org',
      type: 'string',
    })
    .option('workingCopyFolder', {
      description: 'specify working copy folder',
      type: 'string',
    })
    .option('select', {
      description: 'switch to a selected version',
      type: 'boolean',
    })
    .option('componentToTrunk', {
      description: 'switch a selected component to trunk and update its svn:external definition. Can only be used on solution trunk',
      type: 'boolean',
    })
    .option('verbose', {
      description: 'provide additional information in the output',
      default: false,
      type: 'boolean',
    })
    .option('profile', {
      description: 'use a particular profile',
      type: 'string',
    })
    .option('writeJsonFiles', {
      description: 'write intermediate json files, like externals.jon, internals.json and all.json',
      type: 'boolean',
    })
    .option('deploymentCheck', {
      description: 'write intermediate json files, like externals.jon, internals.json and all.json',
      type: 'boolean',
    })
    .option('tagReport', {
      description: 'generate a tag report for each component. Switches off [S],[U],[F] and [C]',
      type: 'boolean',
    })
    .option('includeTagged', {
      description: 'mode for --tagReport. Include issues for components already tagged',
      type: 'boolean',
    })
    .option('includeInternals', {
      description: 'mode for --tagReport. Include issues for internals',
      type: 'boolean',
    })
    .option('tagReportExecution', {
      description: 'execute the tag report that is provided on the command line. Switches off [S],[U],[F] and [C]',
      type: 'string',
    })
    .option('tagReportExecutionMode', {
      describe: 'execution of the tag report: either component-only or solution-only',
      choices: ['component', 'solution'],
      default: 'component',
    })
    .option('forceSVN', {
      description: "[S]witch and [U] despite 'Be Informed running' warning",
      type: 'boolean',
    })
    .option('switch', {
      description: 'enable switch, also when not enabled in profile',
      type: 'boolean',
    })
    .option('update', {
      alias: 'u',
      description: 'enable update, also when not enabled in profile',
      type: 'boolean',
    })
    .option('flyway', {
      alias: 'f',
      description: 'enable flyway, also when not enabled in profile. Profile must contain flyway configuration to have effect.',
      type: 'boolean',
    })
    .option('flywayValidateOnly', {
      description: 'instead of migrate, use validate actions. This will list any validation lines. This automatically enables verbose',
      type: 'boolean',
    })
    .option('compare', {
      description: 'enable specific compare, also when not enabled in profile. Profile must contain compare configuration to have effect.',
      type: 'boolean',
    })
    .option('verbose', {
      alias: 'v',
      description: 'enable verbose, also when not enabled in profile.',
      type: 'boolean',
    })
    .option('keepUp', {
      description: 'update potential updates from the last run .',
      type: 'boolean',
    })
    .option('component', {
      description: "limit the set of components to (partly) match the specified string (case insenstive), i.e. --component '_CONTINUOUS_DELIVERY' or --component 'assessment'.",
      type: 'string',
    })
    .option('startRow', {
      description: 'take action from this row number and beyond',
      default: 1,
      type: 'number',
    })
    .option('startProject', {
      description: 'take action from this project and beyond',
      default: '1', // defausomething that is alphabetically before anything else
      type: 'string',
    })
    .option('svnOptionsUsername', {
      description: 'svn username',
      default: '',
      type: 'string',
    })
    .option('svnOptionsPassword', {
      description: 'svn password',
      default: '',
      type: 'string',
    })
    .option('jiraUsername', {
      description: 'jira username',
      default: '',
      type: 'string',
    })
    .option('jiraPassword', {
      description: 'jira password',
      default: '',
      type: 'string',
    })
    .option('solutionTagFrom', {
      description: 'specify an existing solution tag to start comparing from, instead of the default, previous tag',
      default: '',
      type: 'string',
    })
    .help()
    .alias('help', 'h').argv,
};

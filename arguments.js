const yargs = require('yargs');
const arrSolutions = require('./solutions.json');

module.exports = {
  argv: yargs
    .strict()
    .option('app', {
      describe: 'choose an app',
      choices: ['mbs', 'mts'],
    })
    .option('solution', {
      describe: 'choose a solution',
      choices: arrSolutions.map(({ name }) => name),
    })
    .option('workingCopyFolder', {
      description: 'specify working copy folder',
      type: 'string',
    })
    .option('select', {
      description: 'switch to a selected version',
      type: 'boolean',
    })
    .option('clone', {
      description: 'clone a folder and give it a name that you want',
      type: 'string',
    })
    .option('clone', {
      description: 'clone a folder and give it a name that you want',
      type: 'string',
    })
    .option('cloneName', {
      description: "option of --clone, name of the target folder (will be overwritten!), i.e. --cloneName 'DSC Small New Tax Type'",
      type: 'string',
    })
    .option('cloneReplacements', {
      description: "option of --clone, comma separated list of replacements, each unit separated by an equals character, i.e. --cloneReplacements 'isl=nst,interim stabilization levy=new small tax type'",
      type: 'string',
    })
    .option('componentToTrunk', {
      description: 'switch a selected, tagged component to trunk and update its svn:external definition. Can only be used on solution trunk',
      type: 'boolean',
    })
    .option('componentsToTrunk', {
      description: 'switch a selected, tagged set of components to trunk and update their svn:external definition. Can only be used on solution trunk',
      type: 'boolean',
    })
    .option('componentToTag', {
      description: 'switch a selected component on trunk to an existing tag and update its svn:external definition. Can only be used on solution trunk',
      type: 'boolean',
    })
    .option('limitToUnchanged', {
      description: 'additional option for --componentToTag. Limit the list of components to only the components which do not have commited changes on the trunk yet. These components can be safely switched back to the latest tag.',
      type: 'boolean',
    })
    .option('verbose', {
      description: 'provide additional information in the output',
      default: false,
      type: 'boolean',
    })
    .option('quiet', {
      description: 'do not notify teams channel',
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
    .option('checkSpecifics', {
      description: 'check reference to specific bixml files from core and interface project in alle known implementations',
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
    .option('tagReportMode', {
      describe: 'tag report mode: either component or solution',
      choices: ['component', 'solution'],
      default: 'solution',
    })
    .option('tagReportSolutionMajorIncrement', {
      describe: 'Major Version increment, ie. 2.8.0 becomes 3.0.0 not 2.9.0',
      type: 'boolean',
      default: 'false',
    })
    .option('tagReportMinimumSemVer', {
      describe: 'Minimum component semantic version number, ie when set to "2.0.0" and component is 1.8.0, it will be increment to 2.0.0',
      type: 'string',
      default: '1.1.0',
    })
    .option('tagReportExecutionMode', {
      describe: 'execution of the tag report: either component-only or solution-only',
      choices: ['component', 'solution'],
      default: 'component',
    })
    .option('dryRun', {
      description: 'tagReportExecutionMode in dryRun (output only) mode',
      default: true,
      type: 'boolean',
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
      description: 'enable flyway, also when not enabled in profile. Profile must contain flyway configuration to have effect',
      type: 'boolean',
    })
    .option('flywayValidateOnly', {
      description: 'instead of migrate, use validate. This will list any validation lines. This automatically enables verbose',
      type: 'boolean',
    })
    .option('flywayRepairOnly', {
      description: 'instead of migrate, use repair. This automatically enables verbose',
      type: 'boolean',
    })
    .option('compare', {
      description: 'enable specific compare, also when not enabled in profile. Profile must contain compare configuration to have effect',
      type: 'boolean',
    })
    .option('verbose', {
      alias: 'v',
      description: 'enable verbose, also when not enabled in profile',
      type: 'boolean',
    })
    .option('keepUp', {
      description: 'update potential updates from the last run',
      type: 'boolean',
    })
    .option('generateMarkdown', {
      description: 'for every core component, generate markdown (for obsidian)',
      type: 'boolean',
    })
    .option('component', {
      description: "limit the set of components to (partly) match the specified string (case insensitive), i.e. --component '_CONTINUOUS_DELIVERY' or --component 'assessment'",
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
    .option('solutionFrom', {
      // eslint-disable-next-line quotes
      description: `specify an existing solution tag or branch to start comparing from, instead of the default, previous tag or branch. Example: --solutionFrom 'tags/1.9.0' or --solutionFrom 'branches/1.8.0'`,
      default: '',
      type: 'string',
    })
    .option('useCache', {
      description: 'instead of getting externals and internals from the remote repository, use locally cached files (for speed)',
      type: 'boolean',
      default: false,
    })
    .option('allowUnlink', {
      description: 'When svn switch throws errors, delete the project locally, so it will be recognized as [M]issing project on the next run',
      type: 'boolean',
      default: false,
    })
    .option('debug', {
      description: 'Output debug information',
      type: 'boolean',
      default: false,
    })
    .help()
    .alias('help', 'h').argv,
};

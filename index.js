#!/usr/bin/env node
let arrOverallJiraCollection = [];
// handle arguments
const yargs = require('yargs');
const argv = yargs
    .option('app', {
        alias: 'a',
        describe: 'choose an app',
        choices: ['mbs', 'mts']
    })
    .option('workingCopyFolder', {
        alias: 'w',
        description: 'specify working copy folder',
        type: 'string'
    })
    .option('select', {
        alias: 's',
        description: 'switch to a selected version',
        type: 'boolean'
    })
    .option('verbose', {
        alias: 'v',
        description: 'provide additional information in the output',
        default: false,
        type: 'boolean'
    })
    .option('profile', {
        alias: 'p',
        description: 'use a particular profile',
        type: 'string'
    })
    .option('writeJsonFiles', {
        alias: 'j',
        description: 'write intermediate json files, like externals.jon, internals.json and all.json',
        type: 'string'
    })
    .option('deploymentCheck', {
        alias: 'd',
        description: 'write intermediate json files, like externals.jon, internals.json and all.json',
        type: 'boolean'
    })
    .option('tagReport', {
        alias: 't',
        description: 'generate a tag report for each project. Switches off [S],[U],[F] and [C]',
        type: 'boolean'
    })
    .option('tagReportExecution', {
        alias: 'te',
        description: 'execute the tag report that is provided on the command line. Switches off [S],[U],[F] and [C]',
        type: 'string'
    })
    .option('forceSVN', {
        alias: 'f',
        description: 'write intermediate json files, like externals.jon, internals.json and all.json',
        type: 'boolean'
    })
    .option('switch', {
        alias: 'fw',
        description: 'enable switch, also when not enabled in profile',
        type: 'boolean'
    })
    .option('update', {
        alias: 'fu',
        description: 'enable update, also when not enabled in profile',
        type: 'boolean'
    })
    .option('flyway', {
        alias: 'fw',
        description: 'enable flyway, also when not enabled in profile. Profile must contain flyway configuration to have effect.',
        type: 'boolean'
    })
    .option('flywayValidateOnly', {
        alias: 'ff',
        description: 'instead of migrate, use validate actions. This will list any validation lines. This automatically enables verbose',
        type: 'boolean'
    })
    .option('compare', {
        alias: 'fc',
        description: 'enable specific compare, also when not enabled in profile. Profile must contain compare configuration to have effect.',
        type: 'boolean'
    })
    .option('verbose', {
        alias: 'fv',
        description: 'enable verbose, also when not enabled in profile.',
        type: 'boolean'
    })
    .option('keepUp', {
        alias: 'k',
        description: 'update potential updates from the last run .',
        type: 'boolean'
    })
    .option('project', {
        alias: 'pr',
        description: 'limit to a single project. Specify a string with a single project, i.e. "_CONTINUOUS_DELIVERY" or "Development related".',
        type: 'string'
    })
    .option('startRow', {
        alias: 'sr',
        description: 'take action from this row number and beyond',
        default: 1,
        type: 'number'
    })
    .option('startProject', {
        alias: 'sp',
        description: 'take action from this project and beyond',
        default: '1', //defausomething that is alphabetically before anything else
        type: 'string'
    })
    .option('svnOptionsUsername', {
        description: 'svn username',
        default: '',
        type: 'string'
    })
    .option('svnOptionsPassword', {
        description: 'svn password',
        default: '',
        type: 'string'
    })
    .option('jiraUsername', {
        description: 'jira username',
        default: '',
        type: 'string'
    })
    .option('jiraPassword', {
        description: 'jira password',
        default: '',
        type: 'string'
    })
    .help()
    .alias('help', 'h').argv;
//set variables
const fs = require('fs')
const svnUltimate = require('node-svn-ultimate')
const util = require('util')
const { exec } = require("child_process");
const ps = require('ps-node');
const jiraComponent = require('./jira.js');
let profile;
const svnInfoPromise = util.promisify(svnUltimate.commands.info)
const svnPropGetPromise = util.promisify(svnUltimate.commands.propget)
const svnListPromise = util.promisify(svnUltimate.commands.list)
const svnSwitchPromise = util.promisify(svnUltimate.commands.switch)
const svnCleanUpPromise = util.promisify(svnUltimate.commands.cleanup)
const svnUpdatePromise = util.promisify(svnUltimate.commands.update)
const svnStatusPromise = util.promisify(svnUltimate.commands.status)
const svnMergePromise = util.promisify(svnUltimate.commands.merge)
const svnLogPromise = util.promisify(svnUltimate.commands.log)
const svnCopyPromise = util.promisify(svnUltimate.commands.copy)
const processLookup = util.promisify(ps.lookup)
const glob = require('glob');
const globPromise = util.promisify(glob);
const pjson = require('./package.json');
let path = require('path');
let logline = require('./log.js');
const beep = require('node-beep');
const { resolve } = require('path');
const clear = require('clear');
const inquirer = require("inquirer");
const { url } = require('inspector');
let oAppContext, app;
var arrMissingCollection = [];
var arrSwitchUpdateCollection = [];
var arrSVNUpdatedCollection = [];
var arrSVNPotentialUpdateCollection = [];
var arrFlywayUpdatedCollection = [];
var arrCompareSpecificUpdateCollection = [];
var arrDeploymentCheckCollection = [];
var arrTagReportCollection = [];
//app context
oAppContext = getProbableApp();
oAppContext.version = pjson.version;
oAppContext.name = pjson.name;
oAppContext.descriptiveName = pjson.descriptivename;
app = oAppContext.app;
const workingCopyFolder = getWorkingCopyFolder(oAppContext);
//const timestampStart = new Date().toISOString().replaceAll('T', '').replaceAll('-', '').replaceAll(':', '').substring(0, 14)
let timestampStart = ''; //set in prequal;
clear();
prequal();
async function prequal() {
    var sequenceNumber = await getProfileSequenceNumber();
    var isFirstTimeUse;
    if (sequenceNumber === 0) {
        isFirstTimeUse = true;
        sequenceNumber = 1;
    }
    //svn context
    const oSVNInfo = await getSVNContext(app, workingCopyFolder);
    timestampStart = oSVNInfo.svnApp.toLowerCase() + '_' + oSVNInfo.angloSVNPath.replaceAll('.', '_');
    if (isFirstTimeUse) {
        renderTitle();
        const questions = [
            {
                type: "confirm",
                name: "autoSwitch",
                message: "SVN: Would you like to automatically [S]witch to the correct external locations? ",
                default: true
            },
            {
                type: "confirm",
                name: "autoUpdate",
                message: "SVN: Would you like to automatically [U]pdate your project folders? ",
                default: true
            },
            {
                type: "input",
                name: "svnOptionsUsername",
                default: argv.svnOptionsUsername,
                message: "SVN: Optionally provide your SVN user name. It's usually in the format 'xxx.xxxx' or 'ext-xxx.xxxx', for example 'ext-jane.doe' ",
                when: (answers) => answers.autoSwitch || answers.autoUpdate
            },
            {
                type: "input",
                name: "svnOptionsPassword",
                default: argv.svnOptionsPassword,
                message: "SVN: Please provide your SVN password. ",
                when: (answers) => answers.svnOptionsUsername && (answers.autoSwitch || answers.autoUpdate)
            },
            {
                type: "input",
                name: "jiraUsername",
                default: argv.jiraUsername,
                message: "Jira: Provide your JIRA user name.",
                when: (answers) => argv.enableJiraIntegration
            },
            {
                type: "input",
                name: "jiraPassword",
                default: argv.svnOptionsPassword,
                message: "Jira: Please provide your JIRA password. ",
                when: (answers) => argv.enableJiraIntegration && answers.jiraUsername
            },
            {
                type: "confirm",
                name: "flyway",
                message: "Flyway: " + oAppContext.descriptiveName + " is able to execute general and component-level Flyway scripts. Would you like to enable [F]lyway integration? ",
                default: true
            },
            {
                type: "input",
                name: "flywayPath",
                default: "c:/fw/",
                message: "Flyway: Please provide the path to the folder where the Flyway binary (flyway) resides. Use forward slashes, for example 'c:/fw/' ",
                when: (answers) => answers.flyway
            },
            {
                type: "input",
                name: "flywayDatabaseServer",
                default: "localhost",
                message: "Flyway: To store Flyway history, " + oAppContext.descriptiveName + " needs information about the database server. On which machine (or host) is the SQL Server running. Most likely, this is 'localhost' ",
                when: (answers) => answers.flyway
            },
            {
                type: "input",
                name: "flywayDatabaseServerPort",
                default: "1433",
                message: "Flyway: By default, SQL Server runs on port 1433. Just press enter if that is the case, otherwise provide an alternate port number ",
                when: (answers) => answers.flyway
            }, {
                type: "input",
                name: "flywayDatabaseName",
                default: "aia_" + app,
                message: "Flyway: In which database should Flyway register its history? For example 'aia_" + app + "' ",
                when: (answers) => answers.flyway
            },
            {
                type: "input",
                name: "flywayDatabaseUsername",
                default: "sa",
                message: "Flyway: What database user can " + oAppContext.descriptiveName + " use to access the database? For example 'sa' ",
                when: (answers) => answers.flyway
            },
            {
                type: "input",
                name: "flywayDatabasePassword",
                default: "1",
                message: "Flyway: What database password can " + oAppContext.descriptiveName + " use to access the database? Default: '1' ",
                when: (answers) => answers.flyway
            },
            {
                type: "confirm",
                name: "compareSpecific",
                message: "Specific compare: " + oAppContext.descriptiveName + " can [C]ompare your specific projects with specific projects in another repository. Would you like to enable this feature? ",
                default: false
            },
            {
                type: "input",
                name: "compareSpecificRootFolder",
                default: "c:/repo/" + app + "_anguilla_21/",
                message: "Specific compare: Please provide the path to the root of another workspace folder. Use forward slashes, for example 'c:/repo/" + app + "_anguilla_21/'",
                when: (answers) => answers.compareSpecific
            },
            {
                type: "confirm",
                name: "verbose",
                message: "Verbose output: " + oAppContext.descriptiveName + " can output more detailed process information, for example about (potential) SVN updates, flyway operations and specific comparisons. Would you like to enable this feature? ",
                default: false
            },]
        inquirer
            .prompt(questions)
            .then((answers) => {
                if (checkdb(answers)) {
                    var filename = workingCopyFolder + "profile_" + sequenceNumber + ".json";
                    //workaround: if password contains problematic characters then remove svn username and password. User then has to login once, manually
                    if (answers.svnOptionsUsername && answers.svnOptionsUsername.includes('"') || answers.svnOptionsPassword && answers.svnOptionsPassword.includes('"')) {
                        delete answers.svnOptionsUsername;
                        delete answers.svnOptionsPassword;
                    }
                    fs.writeFile(filename, JSON.stringify(answers, null, 2), function (err) { });
                    logNewLine('', 'gray');
                    logNewLine('Your profile has been stored as ' + filename + '. ' + oAppContext.descriptiveName + ' will now continue its operation with this profile.', 'gray');
                    logNewLine('', 'gray');
                    answers.filename = filename;
                    main(answers, oSVNInfo);
                } else {
                    console.log("Unable to access database")
                    beep(2);
                    process.exit()
                }
            })
            .catch((error) => {
                if (error.isTtyError) {
                    console.log("Your console environment is not supported!")
                } else {
                    console.dir(error)
                }
            })
    } else if (argv.select) {
        renderTitleToVersion();
        const svnToVersionBranchesChoices = await svnListPromise(oSVNInfo.appRoot + '/branches');
        let qBranches = svnToVersionBranchesChoices.list.entry.filter(q => !q.name.startsWith('cd_')).slice(-10).map(b => 'branches/'.concat(b.name));
        let qarrToVersion = qBranches //.concat(qTags);
        qarrToVersion.push('trunk');
        const questionsToVersion = [
            {
                type: "list",
                name: "selectedSVNVersion",
                message: "Pick a version, any version.",
                choices: qarrToVersion,
                default: oSVNInfo.currentVersion
            },]
        await inquirer
            .prompt(questionsToVersion)
            .then((answersToVersion) => {
                oSVNInfo.remoteRepo = oSVNInfo.appRoot + answersToVersion.selectedSVNVersion
                var urlParts = oSVNInfo.remoteRepo.split('/');
                oSVNInfo.angloSVNPath = urlParts[urlParts.length - 1];
                oSVNInfo.repo = urlParts[urlParts.length - 2];
                oSVNInfo.svnAndApp = '/svn/' + urlParts[urlParts.length - 3] + '/';
                var fn = 'profile_1.json';
                profile = require(path.normalize(workingCopyFolder + fn))
                profile.filename = fn;
                getSVNContext(app, workingCopyFolder, answersToVersion.selectedSVNVersion)
                main(profile, oSVNInfo);
            })
            .catch((error) => {
                if (error.isTtyError) {
                    console.log("Your console environment is not supported!")
                } else {
                    console.dir(error)
                }
            })
    }
    else {
        if ((argv.hasOwnProperty('profile')) && (argv.profile.length > 0)) {
            profile = require(path.normalize(workingCopyFolder + argv.profile))
            profile.filename = argv.profile;
        }
        else {
            var fn = 'profile_1.json';
            profile = require(path.normalize(workingCopyFolder + fn))
            profile.filename = fn;
        }
        main(profile, oSVNInfo);
    }
}
async function main(profile, oSVNInfo) {
    try {
        const angloSVNPath = oSVNInfo.angloSVNPath;
        const repo = oSVNInfo.repo;
        const baseURL = oSVNInfo.baseURL;
        const appRoot = oSVNInfo.appRoot;
        const remoteRepo = oSVNInfo.remoteRepo; //.replace('MBS','MbS');
        let svnAndApp = oSVNInfo.svnAndApp;
        let svnOptions = { trustServerCert: true };
        //if provided, add username and password to the svn options
        if (profile.svnOptionsUsername && profile.svnOptionsPassword) {
            svnOptions.username = profile.svnOptionsUsername
            svnOptions.password = profile.svnOptionsPassword
        };
        //add domain to profile so it can be left out of the source
        if(!profile.domain){
            profile.domain = oSVNInfo.URL.split('/')[2].split('.').splice(-2).join('.')
          data = fs.readFileSync(profile.filename);
            var json = JSON.parse(data)
            json.domain = profile.domain;
            fs.writeFileSync(profile.filename, JSON.stringify(json))
        }
        //handle command line switch to profile overrides
        if (argv.switch) profile.autoSwitch = argv.switch;
        if (argv.update) profile.autoUpdate = argv.update;
        if (argv.flyway && profile.flywayPath) profile.flyway = argv.flyway;
        if (argv.flywayValidateOnly) profile.verbose = argv.flywayValidateOnly;
        if (argv.compare && profile.compareSpecificRootFolder) profile.compareSpecific = argv.compare;
        if (argv.verbose) profile.verbose = argv.verbose;
        if (argv.tagReport || argv.tagReportExecution || argv.deploymentCheck) profile.autoSwitch = false, profile.autoUpdate = false, profile.flyway = false, profile.compareSpecific = false, profile.verbose = true;
        let arrAll = [];
        let s;
        let sp = ' ';
        s = 'project folder';
        logNewLine(s + ':' + giveSpace(s, sp) + embrace(workingCopyFolder.toLowerCase()), 'cyan');
        s = 'repo';
        logNewLine(s + ':' + giveSpace(s, sp) + embrace(remoteRepo.toLowerCase()), 'cyan');
        s = 'application';
        logNewLine(s + ':' + giveSpace(s, sp) + embrace(app), 'cyan');
        s = 'profile';
        logNewLine(s + ':' + giveSpace(s, sp) + '[' + profile.filename + ':' + ' [S]witch]:' + profile.autoSwitch + ' | [U]pdate:' + profile.autoUpdate + ' | [F]lyway:' + profile.flyway + ' | [C]ompare specific:' + profile.compareSpecific, 'cyan');
        s = oAppContext.descriptiveName.toLowerCase() + ' version';
        logNewLine(s + ':' + giveSpace(s, sp) + embrace(oAppContext.version), 'cyan');
        if (repo.includes('branches') && profile.flyway && !argv.flyway) {
            profile.flyway = false;
            logNewLine('', 'white');
            logNewLine("The current workspace points to a branch. " + oAppContext.descriptiveName + " disabled profile setting 'Flyway', as it might have undesireable effects on the database. To enable, use command line option --flyway.", 'red')
        }
        if (true) { //profile.autoSwitch || profile.autoUpdate || argv.select
            //get externals
            const svn_externals = await svnPropGetPromise('svn:externals', remoteRepo, svnOptions);
            logNewLine('', 'gray');
            logNewLine('getting externals', 'gray');
            const myArray = svn_externals.target.property._.split("\r\n");
            var arrExternals = [];
            myArray.forEach(function (entry) {
                var name
                if (entry.includes('\'')) {
                    var item = entry.split(" '");
                } else {
                    var item = entry.split(" ");
                }
                var path = item[0];
                if (item.length === 2) {
                    name = item[1].replace(/[']/g, '');
                }
                else if (item.length === 1) {
                    name = item[0];
                }
                //for componentBaseFolder. If domain-specific, keep first 3, else keep first 4 parts
                let partsToKeep = (name.toLowerCase().startsWith('dsc')) ? 4 : 5
                if (name !== "") {
                    arrExternals.push({
                        key: name,
                        path: decodeURI(path),
                        componentBaseFolder: decodeURI(path.split('/').slice(0, partsToKeep).join('/')).replace('//', '/'),
                        isExternal: true,
                        isCoreComponent: !name.toLowerCase().includes('interface def'),
                        isInterfaceDefinition: name.toLowerCase().includes('interface def'),
                        isSpecific: name.toLowerCase().includes('specific'),
                        isDomainSpecific: name.toLowerCase().startsWith('dsc'),
                        isSolutionComponent: name.toLowerCase().startsWith('sc'),
                        isTagged: decodeURI(path).toLocaleLowerCase().includes('/tags/'),
                        isBranched: decodeURI(path).toLocaleLowerCase().includes('/branches/'),
                        isTrunk: decodeURI(path).toLocaleLowerCase().includes('/trunk/')
                    })
                };
            });
            if (argv.writeJsonFiles) {
                fs.writeFileSync("./externals.json", JSON.stringify(arrExternals, null, 2));
            }
            //get internals
            const svn_internals = await svnListPromise(remoteRepo);
            logNewLine('getting internals', 'gray');
            svn_internals.list.entry.forEach(function (entry) {
                delete entry.$;
                delete entry.commit;
                delete Object.assign(entry, { ['key']: entry['name'] })['name'];
                entry.isInternal = true;
                entry.isCoreComponent = false;
                entry.isInterfaceDefinition = false;
                entry.isSpecific = entry.key.toLowerCase().includes('specific');
                entry.isDomainSpecific = entry.key.toLowerCase().startsWith('dsc');
                entry.isSolutionComponent = entry.key.toLowerCase().startsWith('sc');
                entry.path = svnAndApp + repo + '/' + angloSVNPath + '/' + entry.key;
                isTagged = decodeURI(entry.path).toLocaleLowerCase().includes('/tags/');
                isBranched = decodeURI(entry.path).toLocaleLowerCase().includes('/branches/');
                isTrunk = decodeURI(entry.path).toLocaleLowerCase().includes('/trunk/');
            });
            let arrInternals = svn_internals.list.entry;
            if (argv.writeJsonFiles) {
                fs.writeFileSync("./internals.json", JSON.stringify(arrInternals, null, 2));
            }
            //combine external and interal arrays, but filter empty elements
            arrAll = arrExternals.concat(arrInternals);
            // tagreportexecution: limit the projects to the ones stored in the tagreport
            if (argv.tagReportExecution) {
                var tagReportArray = [];
                var fn = argv.tagReportExecution;
                if (fs.existsSync(path.normalize(workingCopyFolder + fn))) {
                    tagReportArray = require(path.normalize(workingCopyFolder + fn))
                }
                arrAll = arrAll.filter(x => tagReportArray.find(y => (y.component == x.key)));
            }
            // inherit exclude json from app project and store locally if not exists
            var excludeArray = [];
            if (!fs.existsSync(workingCopyFolder + '/exclude.json')) {
                excludeArray = require('./exclude.json');
                fs.writeFileSync("./exclude.json", JSON.stringify(excludeArray, null, 2));
            } else {
                // load local exclude list
                excludeArray = require(workingCopyFolder + '/exclude.json');
            }
            //apply to combined array 
            arrAll = arrAll.filter(project => !excludeArray.includes(project.key))
            // inherit include json from app project and store locally if not exists
            var includeArray = [];
            if (!fs.existsSync(workingCopyFolder + '/include.json')) {
                includeArray = require('./include.json');
                fs.writeFileSync("./include.json", JSON.stringify(includeArray, null, 2));
            } else {
                // load local include list
                includeArray = require(workingCopyFolder + '/include.json');
                // concat the keepup list so only the keepup list applies for this run
                if (argv.project) {
                    includeArray.push(argv.project);
                }
                // concat the keepup list so only the keepup list applies for this run
                keepUpFile = workingCopyFolder + 'keepUp.json'
                if (argv.keepUp && fs.existsSync(keepUpFile)) {
                    keepupArray = require(keepUpFile);
                    if (keepupArray.length > 0) {
                        includeArray = includeArray.concat(keepupArray);
                        profile.autoUpdate = true;
                    }
                }
            }
            if (includeArray.length > 1) {
                arrAll = arrAll.filter(project => includeArray.includes(project.key))
            }
            arrAll.sort((a, b) => a.key.localeCompare(b.key))
            // move _CONTINUOUS_DELIVERY to last position
            if (profile.flyway || true) {
                if (arrAll.findIndex(p => p.key == "_CONTINUOUS_DELIVERY") != -1) {
                    arrAll.push(arrAll.shift());
                }
            }
            if (argv.writeJsonFiles) {
                fs.writeFileSync("./all.json", JSON.stringify(arrAll, null, 2));
            }
        } else {
            arrAll = require(workingCopyFolder + "./all.json")
        }
        let loop_len = arrAll.length;
        let startTime = new Date();
        var progressCounter = 1;
        const processLookupResultList = await processLookup({ command: 'Be Informed AMS.exe', psargs: app })
        let beInformedRunning = false;
        processLookupResultList.forEach(function (process) {
            //use -data argument to be more specific in determining when be informed is running
            if (process && (JSON.stringify(process.arguments).toLowerCase().includes('-data') && JSON.stringify(process.arguments).toLowerCase().includes(app.toLowerCase()) || !JSON.stringify(process.arguments).toLowerCase().includes('-data')) && !argv.forceSVN) {
                beInformedRunning = true
            }
        })
        let actions = [];
        if (true) { actions.push('   [M]issing project detection') };
        if (profile.autoSwitch && beInformedRunning) { actions.push(`   [Š]witch detection`) };
        if (profile.autoSwitch && !beInformedRunning) { actions.push('   [S]witch') };
        if (profile.autoUpdate && beInformedRunning) { actions.push(`   [Ŭ]pdate detection`) };
        if (profile.autoUpdate && !beInformedRunning) { actions.push('   [U]pdate') };
        if (profile.flyway && !argv.flywayValidateOnly) { actions.push('   [F]lyway') };
        if (profile.flyway && argv.flywayValidateOnly) { actions.push('   [F]lyway validate only') };
        if (profile.compareSpecific) { actions.push('   [C]ompare specific') };
        if (argv.deploymentCheck) { actions.push('   [D]eployment check') };
        if (argv.tagReport) { actions.push('   [T]ag report') };
        if (argv.tagReportExecution) { actions.push('   [T]ag report execution') };
        showBIRunningWarning(beInformedRunning);
        // render capabilities
        if (actions.length > 0) {
            logNewLine('', 'gray');
            logNewLine('actions legend: ', 'gray');
        }
        actions.forEach(function (action) {
            //logNewLine(action, 'gray');
            logNewLine(' '.repeat(action.length - 2) + giveSpace(action, ' ') + action, 'cyan');
        });
        showLegend();
        logNewLine('', 'gray');
        let lengthLongestProjectNameMap = (key, array) => Math.max(...array.map(arrAll => arrAll[key].length));
        let lengthLongestProjectName = (lengthLongestProjectNameMap("key", /*in*/ arrAll));
        let spacer = '∙';
        //loop all folder in arrAll        
        for await (const entry of arrAll) {
            //if startRow or startProject have been set: start from there, otherwise start from the first
            if ((progressCounter >= argv.startRow) && (entry.key.toLowerCase() >= argv.startProject.toLowerCase())) {
                logThisLine(getProgressString(progressCounter, arrAll.length) + ' ' + entry.key, 'gray');
                logThisLine(' ' + spacer.repeat(130 - lengthLongestProjectName - entry.key.length), 'gray');
                const dir = unifyPath(workingCopyFolder) + entry.key;
                const dirWithQuotedProjectName = unifyPath(workingCopyFolder) + JSON.stringify(entry.key);
                if (fs.existsSync(dir)) {
                    entry.found = true;
                    entry.path = entry.path.replace(/^\//, ''); //remove leading / from path if necessary                
                    componentContinuousDeliveryFolder = dir + '/_CONTINUOUS_DELIVERY/DATABASE_MIGRATIONS/'
                    entry.componentContinuousDeliveryFolderFound = (fs.existsSync(componentContinuousDeliveryFolder));
                    entry.generalContinuousDeliveryFolderFound = (entry.key === '_CONTINUOUS_DELIVERY');
                    entry.local_path = dir
                    const resultInfo = await svnInfoPromise(dirWithQuotedProjectName, svnOptions);
                    entry.svninfo = resultInfo;
                    entry.local_project_repo = baseURL + entry.path
                    var switchPath = baseURL + entry.path;
                    entry.match = (switchPath.toLowerCase() == decodeURI(resultInfo.entry.url).toLowerCase())
                    //switch if autoswtich enabled local and remote do not match
                    if (profile.autoSwitch) {
                        if (!beInformedRunning) {
                            if (!entry.match) {
                                const cleanedSwitch = await svnCleanUpPromise(dirWithQuotedProjectName, svnOptions);
                                try {
                                    const switched = await svnSwitchPromise(JSON.stringify(switchPath), dirWithQuotedProjectName, svnOptions)
                                    memorable('[S]', arrSwitchUpdateCollection, entry, switched, 'green')
                                } catch (error) {
                                    logThisLine(`[Š] Errors while switching`, 'red');
                                }
                            } else {
                                // no switch necessary
                                logThisLine(`[S]`, 'gray');
                            }
                        } else {
                            if (!entry.match) {
                                // potential switch, since be informed is running
                                logThisLine(`[Š]`, 'yellow');
                            } else {
                                // no switch necessary
                                logThisLine(`[Š]`, 'gray');
                            }
                        }
                    } else {
                        //[S] not enabled
                    }
                    //update if autoUpdate enabled
                    if (profile.autoUpdate) {
                        if (!beInformedRunning) {
                            const cleanedUpdate = await svnCleanUpPromise(dirWithQuotedProjectName, svnOptions);
                            const updated = await svnUpdatePromise(dirWithQuotedProjectName, svnOptions)
                            if (updated.includes("Updated to revision")) {
                                if (profile.verbose) {
                                    memorable('[U]', arrSVNUpdatedCollection, entry, updated, 'green')
                                    logNewLine('', 'gray');
                                    logNewLine('', 'gray');
                                    console.log('', updated)
                                } else {
                                    memorable('[U]', arrSVNUpdatedCollection, entry, updated, 'green')
                                }
                            }
                            if (updated.includes("At revision")) {
                                logThisLine('[U]', 'gray');
                            }
                            if (updated.includes("Summary of conflicts")) {
                                if (profile.verbose) {
                                    console.log('[U] conflict detected, Resolve conflict(s) first: ', updated);  //chalk.red(
                                    beep(3);
                                    process.exit()
                                }
                            }
                        } else {
                            //[U] enabled, but BI is running, so [Ŭ]. Only incoming updates, not outgoing
                            const svnStatusOptions = JSON.parse(JSON.stringify(svnOptions));
                            svnStatusOptions.params = ['--dry-run -r BASE:HEAD ' + dirWithQuotedProjectName];
                            const mergeList = await svnMergePromise(dirWithQuotedProjectName, svnStatusOptions)
                            if (mergeList) {
                                memorable("[Ŭ]", arrSVNPotentialUpdateCollection, entry, mergeList, 'yellow')
                                if (profile.verbose) {
                                    logNewLine('', 'gray');
                                    logNewLine('', 'gray');
                                    logNewLine(mergeList.replace(/^--- Merging .*/m, ''), 'yellow');
                                }
                            } else {
                                //[Ŭ] no action needed
                                logThisLine("[Ŭ]", 'gray');
                            }
                        }
                    } else {
                        //[U] not enabled
                    }
                    //perform db migrations if flyway enabled and current project has a migration folder (component or general)
                    if (profile.flyway) {
                        //set default flyway action to migrate
                        var flywayAction = 'migrate';
                        //override default when command line option flywayValidateOnly is set
                        if (argv.flywayValidateOnly) flywayAction = 'validate'; //instead of migrate
                        const flywayDatabaseTable = '__MigrationsHistory';
                        const flywayDatabaseSchema = 'migrations';
                        if (entry.componentContinuousDeliveryFolderFound || entry.generalContinuousDeliveryFolderFound) {
                            var flywayTable;
                            var flywayLocations;
                            if (entry.generalContinuousDeliveryFolderFound) {
                                flywayTable = JSON.stringify(flywayDatabaseTable);
                                flywayLocations = JSON.stringify('filesystem:' + dir + '/_GENERAL/DATABASE_MIGRATIONS/');
                            } else {
                                flywayTable = JSON.stringify(entry.key);
                                flywayLocations = JSON.stringify('filesystem:' + dir + '/_CONTINUOUS_DELIVERY/DATABASE_MIGRATIONS/');
                            }
                            flywayDatabaseConnectionString = `jdbc:sqlserver://${profile.flywayDatabaseServer}:${profile.flywayDatabaseServerPort};databaseName=${profile.flywayDatabaseName};integratedSecurity=false;user=${profile.flywayDatabaseUsername};password=${profile.flywayDatabasePassword};`
                            let flywayCommand = profile.flywayPath + 'flyway ' + flywayAction + ' -color=always -locations=' + flywayLocations + ' -schemas=' + flywayDatabaseSchema + ' -table=' + flywayTable + ' -url=' + flywayDatabaseConnectionString + ' -user=' + profile.flywayDatabaseUsername + ' -password=' + profile.flywayDatabasePassword
                            let flywayResult = await execShellCommand(flywayCommand);
                            flywayResult = flywayResult.replace(/^Database: .*\(Microsoft SQL Server [\d]+\.[\d]+\)/m, '');
                            flywayResult = flywayResult.replace(/^Flyway Community Edition .*/m, '');
                            flywayResult = flywayResult.replace(/^Current version of schema .*/m, '');
                            flywayResult = flywayResult.trim();
                            if (flywayResult.includes("No migration necessary")) {
                                logThisLine('[F]', 'gray');
                            } else {
                                memorable('[F]', arrFlywayUpdatedCollection, entry, flywayResult, 'green')
                                if (profile.verbose) {
                                    logNewLine('', 'white')
                                    logNewLine('', 'white')
                                    console.dir(flywayResult)
                                }
                            }
                        } else {
                            //flyway enabled, but no continuous delivery folder
                        }
                    } else {
                        //flyway not enabled
                    }
                    //compare specific folder with reference specific
                    if (profile.compareSpecific && entry.isSpecific) {
                        if (entry.isInternal && ((AppIsFullyComparable(oAppContext, profile) && entry.isDomainSpecific) || entry.isSolutionComponent)) {
                            var leftSideFolder = dir;
                            var rightSideFolder = leftSideFolder.replace(workingCopyFolder, profile.compareSpecificRootFolder.toLowerCase());
                            leftSet = await checkPath(leftSideFolder, workingCopyFolder);
                            rightSet = await checkPath(rightSideFolder, profile.compareSpecificRootFolder.toLowerCase());
                            const difference = new Set([
                                ...getDifference(leftSet, rightSet),
                                ...getDifference(rightSet, leftSet),
                            ]);
                            if (difference.size > 0) {
                                memorable('[C]', arrCompareSpecificUpdateCollection, entry, entry.key, 'red');
                                logNewLine('', 'red');
                                difference.forEach(function (dif) {
                                    logNewLine('', 'red');
                                    logThisLine('[C] - ', 'red');
                                    logThisLine(dif, 'gray');
                                });
                                logNewLine('', 'red');
                            }
                            else {
                                logThisLine('[C]', 'gray');
                            }
                        } else {
                            // compareSpecific enabled, but not an internal/specific project
                        }
                    } else {
                        // compareSpecific not enabled
                    }
                    //perform deployment check on project
                    if (argv.deploymentCheck) {
                        if (entry.isExternal) {
                            if (entry.isTagged) {
                                logThisLine('[D]', 'green');
                            } else {
                                memorable('[D]', arrDeploymentCheckCollection, entry, entry.key, 'red');
                            }
                        } else {
                            //not external
                        }
                    } else {
                        // deploymentCheck not enabled
                    }
                    //create a jira tag report for each project
                    if (argv.tagReport) {
                        if (entry.isCoreComponent) { //entry.isTrunk//entry.isExternal &&
                            //get list of tags of this external
                            var str = entry.componentBaseFolder;
                            var strSplittedArray = str.split('/');
                            var tagIndex = strSplittedArray.indexOf('tags');
                            var sListURL;
                            sListURL = `"${baseURL}${entry.componentBaseFolder}/tags"`;
                            //get list of tags of this entry
                            const lsTags = await svnListPromise(sListURL);
                            arrTags = lsTags.list.entry.filter(item => !isNaN(item.name.charAt(0)));
                            //properly order semantic tags
                            if (arrTags.length > 1) {
                                arrTagsSorted = arrTags.map(a => a.name.replace(/\d+/g, n => +n + 100000)).sort().map(a => a.replace(/\d+/g, n => +n - 100000));
                            } else {
                                //nothing to be sorted since there's only 1
                                arrTagsSorted = arrTags
                            }
                            if (Array.isArray(arrTagsSorted)) {
                                let tagIndexSubtractor = (entry.isTrunk) ? 1 : 2
                                var lastTagNumber = arrTagsSorted[arrTagsSorted.length - tagIndexSubtractor];
                                var lastTagObject = arrTags.find(q => q.name === lastTagNumber);
                                var lastTagRevisionNumber = lastTagObject.commit.$.revision
                            } else {
                                // current tag is the first tag
                                console.log('current tag is the first tag: to be implemented')
                            }
                            var bComponentLevelMajorTagNumberIncrease = false; //can be modified below
                            const cloneSvnOptions = JSON.parse(JSON.stringify(svnOptions));
                            cloneSvnOptions.revision = `${lastTagRevisionNumber}:HEAD`//:{${dateOfCurrentTag}} --verbose`
                            cloneSvnOptions.verbose = true
                            const logList = await svnLogPromise(`"${baseURL}${entry.componentBaseFolder}"`, cloneSvnOptions);
                            if (logList.logentry && logList.logentry.length > 0) {
                                logThisLine('[T]', 'green');
                                if (entry.isTagged) logThisLine(' - already tagged', 'red');
                                var logListEntries = logList.logentry
                                //filter the log entries to have only commit messages with JIRA numbers
                                regExJira = new RegExp('([A-Z][A-Z0-9]+-[0-9]+)', 'g');
                                logListEntries = logListEntries.filter(l => l.author !== 'continuousdelivery' && regExJira.test(l.msg.toUpperCase()));
                                //add selected entries in an custom array
                                let arrProjectJiraCollection = [];
                                //keep unique jira projects in separate array
                                let arrJiraProjects = [];
                                logNewLine('', 'gray');
                                for await (const jiraEntry of logListEntries) {
                                    //add item only if it is not in the collection already
                                    var jiraIssueNumber = jiraEntry.msg.match(regExJira).toString().toUpperCase().trim();
                                    for (const singularJiraIssueNumber of jiraIssueNumber.split(',')) {
                                        var bIssueLevelMajorTagNumberIncrease = false;
                                        if (JSON.stringify(jiraEntry.paths.path).toLowerCase().includes('versioned') || JSON.stringify(jiraEntry.paths.path).toLowerCase().includes('interface')) {
                                            bIssueLevelMajorTagNumberIncrease = true;
                                            bComponentLevelMajorTagNumberIncrease = true;
                                        }
                                        //add unique jira issue to object array
                                        if (arrProjectJiraCollection.findIndex(j => j.jiraIssueNumber === singularJiraIssueNumber) === -1) {
                                            var commitMessageString = jiraEntry.msg.replace(jiraEntry.msg.match(regExJira).toString(), '').replace(/^. |: |- |, /, '').replace(`https://jira.${profile.domain}/browse/`, '').trim()
                                            const listAllJiraAngloProjects = ['AIRD', 'AISSB', 'CONVA', 'IRDM', 'IRD', 'MTSSSKN', 'MTS', 'SDES', 'ISD', 'MBSAI', 'MTSAI', 'SDTSS', 'SSB'];
                                            if (listAllJiraAngloProjects.includes(singularJiraIssueNumber.split('-')[0])) {
                                                try {
                                                    theIssue = await jiraComponent.getJiraIssue(profile.jiraUsername, profile.jiraPassword, singularJiraIssueNumber);
                                                    var issueSummary = theIssue.fields.summary;
                                                    var issueStatus = theIssue.fields.status.name;
                                                    var currentFixVersions = theIssue.fields.fixVersions
                                                } catch (error) {
                                                    var issueSummary = 'could not be retrieved due to error';
                                                    var issueStatus = 'could not be retrieved due to error'
                                                    var currentFixVersions = [];
                                                }
                                                const listUnwantedJiraIssueStates = []; //'Ready for development', 'In test', 'On hold'
                                                if (!listUnwantedJiraIssueStates.includes(theIssue.fields.status.name)) {
                                                    //add unique jira project to array
                                                    var jiraProject = singularJiraIssueNumber.substring(0, singularJiraIssueNumber.indexOf('-'));
                                                    if (arrJiraProjects.indexOf(jiraProject) === -1) arrJiraProjects.push(jiraProject);
                                                    //add jira issue to object array
                                                    arrProjectJiraCollection.push(
                                                        {
                                                            jiraIssueNumber: singularJiraIssueNumber,
                                                            jiraIssueDescription: issueSummary,
                                                            issueStatus,
                                                            commitMessages: [],
                                                            currentFixVersions
                                                        }
                                                    )
                                                    logNewLine('', 'gray')
                                                    logThisLine(`Add:  ${singularJiraIssueNumber}`, 'green')
                                                    logThisLine(`${bIssueLevelMajorTagNumberIncrease ? ' [Major]' : ''}`, 'red')
                                                    arrProjectJiraCollection[arrProjectJiraCollection.length - 1].commitMessages.push(commitMessageString);
                                                } else {
                                                    logNewLine('', 'gray')
                                                    logThisLine(`Skip: ${singularJiraIssueNumber}`, 'yellow')
                                                    logThisLine(` [${theIssue.fields.status.name}]`, 'yellow')
                                                }
                                            } else {
                                                logNewLine('', 'gray');
                                                logNewLine('Comment contains invalid or unknown JIRA project: ' + singularJiraIssueNumber, 'red');
                                            }
                                        } else {
                                            //add commit msg to appropriate issue issue object
                                            var indexOfExistingJiraIssue = arrProjectJiraCollection.findIndex(j => j.jiraIssueNumber === singularJiraIssueNumber)
                                            if (arrProjectJiraCollection[indexOfExistingJiraIssue].commitMessages.indexOf(commitMessageString) === -1) {
                                                arrProjectJiraCollection[indexOfExistingJiraIssue].commitMessages.push(commitMessageString)
                                            }
                                        };
                                    }
                                }
                                var derivedNewTagNumber = await getDerivedNewTagNumber(dirWithQuotedProjectName, bComponentLevelMajorTagNumberIncrease, lastTagNumber)
                                if (profile.verbose) {
                                    logNewLine('', 'gray');
                                    logNewLine('', 'gray');
                                    logNewLine(`${derivedNewTagNumber.impact}: ${entry.key} from ${lastTagNumber} to ${derivedNewTagNumber.derivedNewTagNumber}, [${arrProjectJiraCollection.length} JIRA issues]`, "green");
                                }
                                var fixVersionNumber = derivedNewTagNumber.derivedNewTagNumber;
                                var fixVersionName = entry.key + ' ' + derivedNewTagNumber.derivedNewTagNumber;
                                //sort jira issue alphabetically
                                arrProjectJiraCollection.sort();
                                //todo: use array.map
                                //now derivedNewTagNumber is known. Go over the jira issues and batch update the fix version
                                for await (const j of arrProjectJiraCollection) {
                                    j.project = entry.key;
                                    j.curl = `curl --location --request PUT 'https://jira.${profile.domain}/rest/api/latest/issue/${j.jiraIssueNumber}' --header 'Authorization: ${'Basic ' + Buffer.from(argv.jiraUsername + ":" + argv.jiraPassword, 'binary').toString('base64')} --header 'Content-Type: application/json' --data-raw '{ \"update\": { \"fixVersions\": [{ \"set\": [{ \"name\": \"${fixVersionName}\" }]}] } }'`
                                }
                                arrOverallJiraCollection = arrOverallJiraCollection.concat(arrProjectJiraCollection)
                                arrTagReportCollection.push({
                                    component: entry.key,
                                    lastTagRevisionNumber: lastTagRevisionNumber,
                                    lastTagNumber: lastTagNumber,
                                    newTagNumber: fixVersionNumber,
                                    newTagName: fixVersionName,
                                    isMajor: (derivedNewTagNumber.impact === 'Major'),
                                    jiraProjects: arrJiraProjects,
                                    jiraIssues: arrProjectJiraCollection,
                                    wasAlreadyTagged: entry.isTagged
                                });
                                //write (append to new or existing file)
                                var filename = workingCopyFolder + "tagreport_" + timestampStart;
                                fs.writeFileSync(filename + '.json', JSON.stringify(arrTagReportCollection, null, 2));
                                const xlsx = require("xlsx")//npm install xlsx
                                var newWB = xlsx.utils.book_new()
                                const excelProjectArray = arrTagReportCollection.map(({ jiraProjects, jiraIssues, ...keepAttrs }) => keepAttrs)
                                var objProject = excelProjectArray.map((e) => {
                                    return e
                                })
                                var newWSProject = xlsx.utils.json_to_sheet(objProject)
                                const excelJiraArray = arrOverallJiraCollection.map(({ commitMessages, currentFixVersions, ...keepAttrs }) => keepAttrs)
                                var objIssue = excelJiraArray.map((e) => {
                                    return e
                                })
                                var newWSIssue = xlsx.utils.json_to_sheet(objIssue)
                                xlsx.utils.book_append_sheet(newWB, newWSProject, "projects")
                                xlsx.utils.book_append_sheet(newWB, newWSIssue, "issues")
                                xlsx.writeFile(newWB, filename + ".xlsx")//file name as param
                            } else logThisLine('[T]', 'white');
                        } else {
                            logThisLine('[T]', 'gray');
                        }
                        //}
                    } else {
                        // tagReport not enabled
                    }
                    if (argv.tagReportExecution) {
                        // set reference to component object in tagReportArry                        
                        tagReportExecutionComponent = tagReportArray.find(y => (y.component == entry.key));
                        logThisLine('[E]', 'gray');
                        logNewLine('', 'gray');
                        logNewLine('', 'gray');

                        if(entry.isTrunk) {
                            //console.log(`Tagging ${entry.componentBaseFolder} with tag ${tagReportExecutionComponent.newTagNumber}`)
                            //const tagResult = await svnCopyPromise(`"${baseURL}${entry.componentBaseFolder}" "${baseURL}${entry.componentBaseFolder}"`);
                            let svnCopyCommand = `svn copy "${baseURL}${entry.componentBaseFolder}" "${baseURL}${entry.componentBaseFolder}/tags/${tagReportExecutionComponent.newTagNumber}" -m "${tagReportExecutionComponent.newTagNumber}"`
                            console.log(`${entry.componentBaseFolder}: ${svnCopyCommand}`)
                            //let tagResult = await execShellCommand(flywayCommand);
                        }

                        if(false) {
                            let tagReportExecutionComponentLevelTagName =  entry.key+' '+tagReportExecutionComponent.newTagNumber;
                            logNewLine(`${tagReportExecutionComponent.component} holding ${tagReportExecutionComponent.jiraIssues.length} issues in ${tagReportExecutionComponent.jiraProjects.length} distinct project(s)`, 'green')
                            let jiraProjecterCounter = 1;
                            for await (const jiraProject of tagReportExecutionComponent.jiraProjects) {
                                //create fix version in each distinct project, if it not exists already
                                logNewLine(`[${jiraProjecterCounter}/${tagReportExecutionComponent.jiraProjects.length}] adding fix version '${tagReportExecutionComponentLevelTagName}' to project '${jiraProject}'`, 'green')
                                //perform on sample project
                                //if (tagReportExecutionComponent.component === 'DSC Business license') {
                                    try {
                                        await jiraComponent.addVersionIfNotExists(profile.jiraUsername, profile.jiraPassword, jiraProject, tagReportExecutionComponentLevelTagName);
                                    } catch (error) {
                                        console.dir('Errors while executing addVersionIfNotExists: ', jiraProject, tagReportExecutionComponentLevelTagName)
                                        beep(3);
                                    }
                                //}
                                jiraProjecterCounter++;
                            }
                            let jiraIssueCounter = 1;
                            for await (const jiraIssue of tagReportExecutionComponent.jiraIssues) {
                                //create fix version in each issue
                                logNewLine(`[${jiraIssueCounter}/${tagReportExecutionComponent.jiraIssues.length}] adding fix version '${tagReportExecutionComponentLevelTagName}' to jira issue '${jiraIssue.jiraIssueNumber}'`, 'green')
                                //perform on sample project
                                //if (tagReportExecutionComponent.component === 'DSC Business license') {
                                    try {
                                        await jiraComponent.updateJiraIssueFixVersion(profile.jiraUsername, profile.jiraPassword, jiraIssue.jiraIssueNumber, tagReportExecutionComponentLevelTagName);
                                    } catch (error) {
                                        console.dir('Errors while executing updateJiraIssueFixVersion: ', jiraIssue.jiraIssueNumber, tagReportExecutionComponentLevelTagName)
                                        beep(3);
                                    }
                                //}
                                jiraIssueCounter++;
                            }
                        }
                        //update external from current version to new tag
                    } else {
                        // tagReport exectuion not enabled
                    }
                } else {
                    memorable('[M]', arrMissingCollection, entry, baseURL + entry.path.replace(/^\//, '').key, 'green');
                    const dir = workingCopyFolder + entry.key;
                    const url = baseURL + entry.path.replace(/^\//, ''); //remove leading / from path if necessary      
                    const e = require("child_process");
                    const execPromise = util.promisify(e.exec);
                    const execCommand = `svn checkout "${url}" "${dir}" --non-interactive`
                    try {
                        const execPromiseResult = await execPromise(execCommand);
                    } catch (error) {
                        console.dir('Errors while executing:', execCommand);//chalk.redBright(
                        beep(3);
                    }
                }
                logNewLine('', 'gray');
            }
            progressCounter++;
        }
        var SummaryCount = (arrMissingCollection.length + arrSwitchUpdateCollection.length + arrSVNUpdatedCollection.length + arrFlywayUpdatedCollection.length + arrCompareSpecificUpdateCollection.length + arrSVNPotentialUpdateCollection.length + arrDeploymentCheckCollection.length + arrTagReportCollection.length);
        if (SummaryCount > 0) {
            logNewLine('', 'gray');
            console.log('Summary:', SummaryCount.toString().trim(), '(potential) updates for ' + app)
            beep(2);
        }
        else {
            logNewLine('', 'gray');
            logNewLine('Summary: ', 'gray');
            logNewLine('No significant updates for ' + app, 'gray');
        }
        if (arrMissingCollection.length > 0) {
            logNewLine(arrMissingCollection.length + ' [M]issing project(s): Choose "Import / General / Existing Projects into workspace" in Be Informed Studio', 'red');
        }
        for (const entry of arrSwitchUpdateCollection) {
            logNewLine('SVN [S]witch: ' + entry, 'green');
        }
        if (arrSwitchUpdateCollection.length > 0) {
            logNewLine(arrSwitchUpdateCollection.length + ' [S]witched project(s) require a rebuild / validate in Be Informed.', 'red');
        }
        for (const entry of arrSVNUpdatedCollection) {
            logNewLine('SVN [U]pdate: ' + entry, 'green');
        }
        if (arrSVNUpdatedCollection.length > 0) {
            logNewLine(arrSVNUpdatedCollection.length + ' [U]pdated project(s) require a rebuild / validate in Be Informed.', 'red');
        }
        for (const entry of arrFlywayUpdatedCollection) {
            logNewLine('[F]lyway: ' + entry, 'gray');
        }
        for (const entry of arrSVNPotentialUpdateCollection) {
            logNewLine('Potential [Ŭ]pdates: ' + entry, 'cyan');
        }
        //store potential updates, so user can update the projects after closing bi using the --keepUp. After an actual update, empty 
        var filename = workingCopyFolder + "keepup.json";
        if (arrSVNPotentialUpdateCollection.length > 0) {
            fs.writeFileSync(filename, JSON.stringify(arrSVNPotentialUpdateCollection, null, 2));
        }
        if (profile.autoUpdate && fs.existsSync(filename)) {
            fs.unlinkSync(filename);
        }
        if (arrCompareSpecificUpdateCollection.length > 0) {
            logNewLine(arrCompareSpecificUpdateCollection.length + ' project for which the [C]ompare specific check failed. Manually investigate the inconsistencies.', 'red');
        }
        if (arrDeploymentCheckCollection.length > 0) {
            logNewLine(arrDeploymentCheckCollection.length + ' project for which the [D]eployment check failed. Tag the relevant externals projects.', 'red');
        }
        if (arrDeploymentCheckCollection.length === 0 && argv.deploymentCheck) {
            logNewLine('Deployment check positive: all externals have been tagged.', 'green');
        }
        if (argv.tagReport && arrTagReportCollection.length > 0) {
            var filename = workingCopyFolder + "tagreport_" + timestampStart + ".json";
            issueCount = arrTagReportCollection.map(a => a.jiraIssues.length).reduce((a, b) => a + b)
            if (arrTagReportCollection && arrTagReportCollection.length > 0 && issueCount && issueCount > 0) {
                logNewLine(`Tag report has been stored as ${filename}. It contains ${arrTagReportCollection.length} projects and ${arrTagReportCollection.map(a => a.jiraIssues.length).reduce((a, b) => a + b)} issues`, 'gray');
            }
        }
        showBIRunningWarning(beInformedRunning);
    } catch (error) {
        //console.log(error)
        console.log('Errors occurred:', error);//chalk.redBright(
        beep(3);
    }
    process.stdout.write('\n');
    process.exit(0);
}
const zeroPad = (num, places) => String(num).padStart(places, '0')
function getProgressString(c, l) {
    return '[' + zeroPad(c, 3) + '/' + zeroPad(l, 3) + ']'
}
function embrace(s) {
    return '[' + s + ']'
}
function logThisLine(t, c, lf) {
    mylog(t, c, false)
}
function logNewLine(t, c, lf) {
    mylog(t, c, true)
}
function execShellCommand(cmd) {
    const exec = require('child_process').exec;
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.warn(error);
            }
            resolve(stdout ? stdout : stderr);
        });
    });
}
function alertTerminal(mode) {
    let beep = require('node-beep');
    if ((mode === 'F') || (mode.includes('U')) || (mode.includes('S')) || (mode === 'C')) {
        beep(1);
    }
}
function mylog(t, c, lf) {
    if ((argv.hasOwnProperty('workingCopyFolder')) && (argv.workingCopyFolder.lenght > 0)) {
        console.log(t);
    }
    else {
        if (c === 'yellow') {
            process.stdout.write("\x1b[93m" + t + "\x1b[39m")
        } else if (c === 'red') {
            process.stdout.write("\x1b[91m" + t + "\x1b[39m")
        }
        else if (c === 'gray') {
            process.stdout.write("\x1b[97m" + t + "\x1b[39m")
        }
        else if (c === 'gray') {
            process.stdout.write(t);
        }
        else if (c === 'white') {
            process.stdout.write("\x1b[97m" + t + "\x1b[37m")
        }
        else if (c === 'green') {
            process.stdout.write("\x1b[32m" + t + "\x1b[39m")
        }
        else if (c === 'blue') {
            process.stdout.write("\x1b[34m" + t + "\x1b[39m")
        }
        else if (c === 'cyan') {
            process.stdout.write("\x1b[36m" + t + "\x1b[39m")
        }
        if (lf) {
            process.stdout.write("\n")
        }
    }
}
function renderTitle() {
    logNewLine('+-'.repeat((process.stdout.columns || defaultColumns) / 4), 'gray');
    logline(` = ` + oAppContext.descriptiveName + ` = `, 'info', '\n');
    logNewLine('+-'.repeat((process.stdout.columns || defaultColumns) / 4), 'gray');
    logNewLine(``, 'gray');
    logNewLine(`Welcome to ` + oAppContext.descriptiveName + `!`, 'gray');
    logNewLine(``, 'gray');
    logNewLine(oAppContext.descriptiveName + ` assists with SVN switches and SVN updates of your projects, detect any missing projects,`, 'gray');
    logNewLine(`execute any general or project flyway scripts and validate the structure of Anglo specific projects.`, 'gray');
    logNewLine(``, 'gray');
    logNewLine(`Since this is probably the first time you're using ` + oAppContext.descriptiveName + `,`, 'gray');
    logNewLine(`please answer the following questions to setup your profile.`, 'gray');
    logNewLine(``, 'gray');
}
function renderTitleToVersion() {
    logNewLine('+-'.repeat((process.stdout.columns || defaultColumns) / 4), 'gray');
    logline(` = ` + oAppContext.descriptiveName + ` = `, 'info', '\n');
    logNewLine('+-'.repeat((process.stdout.columns || defaultColumns) / 4), 'gray');
    logNewLine(``, 'gray');
    logNewLine(`Welcome to ` + oAppContext.descriptiveName + `!`, 'gray');
    logNewLine(``, 'gray');
    logNewLine(oAppContext.descriptiveName + ` assists with moving to a particular SVN version.`, 'gray');
    logNewLine(`Please pick a version from the list below using the arrow keys and press enter to update the current folder to that version.`, 'gray');
    logNewLine(``, 'gray');
    logNewLine(``, 'gray');
}
async function checkPath(folder, baseToReplace) {
    const path = require("path");
    let bixmlContainingPaths = new Set();
    try {
        const files = await globPromise(folder + '/**/*.bixml');
        for (const file of files) {
            bixmlContainingPaths.add(path.join(file.replace(baseToReplace, '')));
        }
    } catch (error) {
        //console.log(error)
        console.log('Errors occurred:', error);
    }
    return bixmlContainingPaths;
}
function getDifference(setA, setB) {
    return new Set(
        [...setA].filter(element => !setB.has(element))
    );
}
function getProbableApp() {
    const svnDir = `.svn`
    if (fs.existsSync(svnDir)) {
        //exit
        logNewLine('Do not run this application in an SVN working copy folder. Move to the root of your workspace or an empy folder.', 'red');
        process.exit(0);
    }
    const cwd = process.cwd().toLowerCase();
    var probableApp = '';
    if (argv.app) {
        probableApp = argv.app
    }
    else if (cwd.includes('mbs') || cwd.includes('mts')) {
        probableApp = determineProbableAngloApp(cwd)
    }
    else if ((fs.existsSync('./MBS Portal'))) {
        probableApp = 'mbs'
    }
    else if ((fs.existsSync('./MTS Portal'))) {
        probableApp = 'mts'
    }
    else {
        console.log('App could not be determined automatically. Please provide an --app as argument.');
        process.exit()
    }
    return {
        app: probableApp,
        workingCopyFolder: cwd
    };
}
async function getSVNContext(app, workingCopyFolder, switchedTo) {
    const dirWithQuotedProjectName = (workingCopyFolder + '\\' + JSON.stringify(app.toUpperCase() + " Portal")).replace(/[\\/]+/g, '/')//.replace(/^([a-zA-Z]+:|\.\/)/, '');
    const dir = `.//${app.toUpperCase()} Portal`
    if (!fs.existsSync(dir)) {
        renderTitleToVersion();
        let qBranches;
        var appRoot = `https://svn.${profile.domain}/svn/${app}_anguilla`;
        try {
            let svnOptions = { trustServerCert: true };
            //if provided, add username and password to the svn options
            if (argv.svnOptionsUsername && argv.svnOptionsPassword) {
                svnOptions.username = argv.svnOptionsUsername
                svnOptions.password = argv.svnOptionsPassword
            };
            const svnToVersionBranchesChoices = await svnListPromise(appRoot + '/branches', svnOptions);
            qBranches = svnToVersionBranchesChoices.list.entry.filter(q => !q.name.startsWith('cd_')).slice(-10).map(b => 'branches/'.concat(b.name));
        } catch (error) {
            logThisLine(`Can't login into SVN. Provide them on the command line, at least once, using --svnOptionsUsername [username] --svnOptionsPassword [password] `, 'red');
            process.exit(0);
        }
        let qarrToVersion = qBranches
        qarrToVersion.push('trunk');
        const questionsToVersion = [
            {
                type: "list",
                name: "selectedSVNVersion",
                message: "Pick a version, any version.",
                choices: qarrToVersion,
                default: 'trunk'
            },]
        await inquirer
            .prompt(questionsToVersion)
            .then(async (answersToVersion) => {
                const url = `https://svn.${profile.domain}/svn/${app.toUpperCase()}_ANGUILLA/${answersToVersion.selectedSVNVersion}/${app.toUpperCase()} Portal`;
                const e = require("child_process");
                const execPromise = util.promisify(e.exec);
                const execCommand = `svn checkout "${url}" "${dir}" --non-interactive`
                const execPromiseResult = await execPromise(execCommand);
            })
            .catch((error) => {
                if (error.isTtyError) {
                    console.log("Your console environment is not supported!")
                } else {
                    console.dir(error)
                }
            })
    }
    const svnInfoPromise = util.promisify(svnUltimate.commands.info);
    const infoResult = await svnInfoPromise(dirWithQuotedProjectName);
    // Define desired object
    var URL = infoResult.entry.url;
    var urlParts = URL.split('/');
    var angloSVNPath = urlParts[urlParts.length - 2];
    if (switchedTo) {
        angloSVNPath = switchedTo;
    }
    var repo = urlParts[urlParts.length - 3];
    if (angloSVNPath == 'trunk') {
        svnAndApp = '/' + urlParts[3] + '/';
        svnApp = urlParts[4];
    } else {
        svnAndApp = '/' + urlParts[3] + '/' + urlParts[4] + '/';
        svnApp = urlParts[4];
    }
    var angloClient = svnApp.toLowerCase().replace(app + '_', '');
    var currentVersion = repo + '/' + angloSVNPath
    var baseURL = urlParts.slice(0, 3).join('/') + '/';
    var appRoot = urlParts.slice(0, 5).join('/') + '/';
    var remoteRepo = urlParts.slice(0, urlParts.length - 1).join('/');
    return {
        URL: URL,
        angloSVNPath: angloSVNPath,
        repo: repo,
        svnAndApp: svnAndApp,
        svnApp: svnApp,
        angloClient: angloClient,
        baseURL: baseURL,
        appRoot: appRoot,
        currentVersion: currentVersion,
        remoteRepo: remoteRepo
    };
}
function getWorkingCopyFolder(oAppContext) {
    if (argv.workingCopyFolder) {
        return unifyPath(argv.workingCopyFolder);
    } else {
        return unifyPath(oAppContext.workingCopyFolder) + '/';
    }
}
function AppIsFullyComparable(oAppContext, profile) {
    return (oAppContext.app === determineProbableAngloApp(profile.compareSpecificRootFolder.toLowerCase()))
}
function determineProbableAngloApp(path) {
    if ((path.toLowerCase().includes('mbs')) && (!path.toLowerCase().includes('mts'))) {
        return 'mbs'
    }
    else if ((path.toLowerCase().includes('mts')) && (!path.toLowerCase().includes('mbs'))) {
        return 'mts'
    } else {
        console.log('nee');
    }
}
function unifyPath(path) {
    return path.toString().toLowerCase().replaceAll('\\', '/')
};
async function getProfileSequenceNumber() {
    const files = await globPromise('profile_[0-9]*.json');
    if (files.length > 0) {
        return parseInt(files.sort().reverse()[0].toString().split('_').reverse()[0].replace('.json', '')) + 1;
    } else {
        return 0
    }
}
function memorable(symbol, collection, entry, payload, color) {
    logThisLine(symbol, color);
    alertTerminal(symbol);
    collection.push(entry.key);
}
async function checkdb(profile) {
    const sql = require('mssql')
    try {
        // config for your database
        var config = {
            user: profile.flywayDatabaseUsername,
            password: profile.flywayDatabasePassword,
            server: profile.flywayDatabaseServer,
            database: profile.flywayDatabaseName,
            trustServerCertificate: true
        };
        await sql.connect(config)
        const result = await sql.query`select count(0) from cmfcase`
    } catch (err) {
        return false
    }
    return true
}
function right(str, chr) {
    return str.slice(str.length - chr, str.length);
}
function giveSpace(stringForLength, spaceChar) {
    return spaceChar.repeat(30 - stringForLength.length)
}
function giveMoreSpace(l, spaceChar) {
    return spaceChar.repeat(l)
}
function showLegend() {
    logNewLine('', 'gray');
    logNewLine('color legend: ', 'white');
    let l = 31, sp = ' ';
    s = '[X]: no action needed';
    logNewLine(giveMoreSpace(l, sp) + s, 'white');
    s = '[X]: potential action need';
    logNewLine(giveMoreSpace(l, sp) + s, 'yellow');
    s = '[X]: action performed';
    logNewLine(giveMoreSpace(l, sp) + s, 'green');
    s = '[X]: warning / error / attention';
    logNewLine(giveMoreSpace(l, sp) + s, 'red');
}
function showBIRunningWarning(beInformedRunning) {
    if (beInformedRunning) {
        logNewLine('', 'red');
        if (profile.autoSwitch || profile.autoUpdate) {
            logNewLine('Warning: Be Informed seems to be running ' + (app).toLowerCase() + '! Regarding svn [U]pdate and [S]witch: Only "detection" possible, indicated by [Š]/[Ŭ]', 'red');
        }
    }
}
async function getRemoteAppVersion() {
    try {
        let url = "https://raw.githubusercontent.com/guidohollander/anglo-helper/master/package.json";
        const https = require('https');
        https.get(url, (res) => {
            let body = "";
            res.on("data", (chunk) => {
                body += chunk;
            });
            res.on("end", () => {
                try {
                    let json = JSON.parse(body);
                    return json.version
                } catch (error) {
                    console.error(error.message);
                };
            });
        }).on("error", (error) => {
            console.error(error.message);
        });
    } catch (error) {
        console.dir('Errors occurred:', error);//chalk.redBright(
        beep(3);
    }
}
async function getDerivedNewTagNumber(workingCopyFolder, bMajor, currentVersion) {
    const e = require("child_process");
    const execPromise = util.promisify(e.exec);
    try {
        currentVersionElements = currentVersion.split('.');
        if (bMajor) {
            positionToRaise = currentVersionElements.length - 2
            currentVersionElements[currentVersionElements.length - 1] = 0
        } else {
            positionToRaise = currentVersionElements.length - 1
        }
        currentVersionElements[positionToRaise] = parseInt(currentVersionElements[positionToRaise]) + 1;
        return {
            derivedNewTagNumber: currentVersionElements.join('.'),
            impact: bMajor ? 'Major' : 'Minor'
        }
    } catch (error) {
        console.dir('Error in getDerivedNewTagNumber: ', execCommand);//chalk.redBright(
        beep(3);
    }
}
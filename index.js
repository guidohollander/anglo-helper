#!/usr/bin/env node
let arrOverallJiraCollection = [];
let arrTagReportSolutionCollection = [];
let tagsCreated=[];
let arrComponents=[];
let arrExt = [];
let arrSVNExternalsPreviousSolutionTag = [];
let arrPreviousExternals = [];

// handle arguments
const yargs = require('yargs');
const argv = yargs
    .option('app', {
        describe: 'choose an app',
        choices: ['mbs', 'mts']
    })
    .option('workingCopyFolder', {
        description: 'specify working copy folder',
        type: 'string'
    })
    .option('select', {
        description: 'switch to a selected version',
        type: 'boolean'
    })
    .option('verbose', {
        description: 'provide additional information in the output',
        default: false,
        type: 'boolean'
    })
    .option('profile', {
        description: 'use a particular profile',
        type: 'string'
    })
    .option('writeJsonFiles', {
        description: 'write intermediate json files, like externals.jon, internals.json and all.json',
        type: 'boolean'
    })
    .option('deploymentCheck', {
        description: 'write intermediate json files, like externals.jon, internals.json and all.json',
        type: 'boolean'
    })
    .option('tagReport', {
        description: 'generate a tag report for each component. Switches off [S],[U],[F] and [C]',
        type: 'boolean'
    })
    .option('tagReportExecution', {
        alias: 'te',
        description: 'execute the tag report that is provided on the command line. Switches off [S],[U],[F] and [C]',
        type: 'string'
    })
    .option('solutionTagReport', {
        description: 'generate a solution tag report. Switches off [S],[U],[F] and [C]',
        type: 'boolean'
    })    
    .option('forceSVN', {
        description: "[S]witch and [U] despite 'Be Informed running' warning",
        type: 'boolean'
    })
    .option('switch', {
        description: 'enable switch, also when not enabled in profile',
        type: 'boolean'
    })
    .option('update', {
        description: 'enable update, also when not enabled in profile',
        type: 'boolean'
    })
    .option('flyway', {
        description: 'enable flyway, also when not enabled in profile. Profile must contain flyway configuration to have effect.',
        type: 'boolean'
    })
    .option('flywayValidateOnly', {
        alias: 'ff',
        description: 'instead of migrate, use validate actions. This will list any validation lines. This automatically enables verbose',
        type: 'boolean'
    })
    .option('compare', {
        description: 'enable specific compare, also when not enabled in profile. Profile must contain compare configuration to have effect.',
        type: 'boolean'
    })
    .option('verbose', {
        description: 'enable verbose, also when not enabled in profile.',
        type: 'boolean'
    })
    .option('keepUp', {
        description: 'update potential updates from the last run .',
        type: 'boolean'
    })
    .option('component', {
        description: 'limit to a single or set of components. Specify a string that occurs in the component name, i.e. "_CONTINUOUS_DELIVERY" or "Additional assessment".',
        type: 'string'
    })
    .option('startRow', {
        description: 'take action from this row number and beyond',
        default: 1,
        type: 'number'
    })
    .option('startProject', {
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
const semver = require('semver')
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
//const svnCopyPromise = util.promisify(svnUltimate.commands.copy)
const svnLastestTagPromise = util.promisify(svnUltimate.util.getLatestTag)
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
var arrSolutions = require('./solutions.json');
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
    timestampStart = oSVNInfo.remoteRepo.substring(oSVNInfo.remoteRepo.indexOf('/svn/') + 5).replaceAll('/','_').replaceAll('.','_').toLowerCase();
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
        const svnToVersionTagsChoices = await svnListPromise(oSVNInfo.appRoot + '/tags');
        let qTags = svnToVersionTagsChoices.list.entry.filter(q => !q.name.startsWith('cd_')).slice(-0).map(b => 'tags/'.concat(b.name));

        const svnToVersionBranchesChoices = await svnListPromise(oSVNInfo.appRoot + '/branches');
        let qBranches = svnToVersionBranchesChoices.list.entry.filter(q => !q.name.startsWith('cd_')).slice(-0).map(b => 'branches/'.concat(b.name));
        let qarrToVersion = qBranches.concat(qTags);
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
        let remoteRepo = oSVNInfo.remoteRepo; //.replace('MBS','MbS');
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
        if (argv.solutionTagReport) argv.tagReport = true;
        if (argv.tagReport || argv.tagReportExecution || argv.deploymentCheck) profile.autoSwitch = false, profile.autoUpdate = false, profile.flyway = false, profile.compareSpecific = false, profile.verbose = true;
        

        //if (argv.tagReport) {
            //gather information about current solution for the tag report
            currentSolution = arrSolutions.find(s => s.name === oSVNInfo.svnApp);
            //oPreviousSolutionTag = await getTag(`${oSVNInfo.remoteRepo}`);
            //oCurrentSolutionTag = (oSVNInfo.angloSVNPath!=='trunk')?await getTag(oSVNInfo.remoteRepo,{currentTag:true}):{tagRevisionNumber:'HEAD',tagUrl:oSVNInfo.remoteRepo}

            oSolution = await getTag(`${oSVNInfo.remoteRepo}`);

        //};
                                                
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
        if ((repo.includes('branches')||(repo.includes('tags'))) && profile.flyway && !argv.flyway) {
            profile.flyway = false;
            logNewLine('', 'white');
            logNewLine("The current workspace points to a tag/branch. " + oAppContext.descriptiveName + " disabled profile setting 'Flyway', as it might have undesireable effects on the database. To enable, use command line option --flyway.", 'red')
        }
        if (true) { //profile.autoSwitch || profile.autoUpdate || argv.select
            //get externals
            logNewLine('', 'gray');
            //let svn_externals = [];
            
            let arrInternalsFilter = [];

            logNewLine(`getting externals from current solution ${oSolution.current.tagNumber}`, 'gray');
            //remoteRepo = "https://svn.bearingpointcaribbean.com/svn/MBS_ANGUILLA/tags/1.8.3"
            arrSVNExternalsCurrentSolutionTag=await getArrExternals(oSolution.current.tagUrl,svnOptions);
            fs.writeFileSync("./current_externals_raw.json", JSON.stringify(arrSVNExternalsCurrentSolutionTag, null, 2));

            if(argv.solutionTagReport) {

                logNewLine(`getting externals from previous solution ${oSolution.previous.tagNumber}`, 'gray');
                //oPreviousSolutionTag.tagUrl = "https://svn.bearingpointcaribbean.com/svn/MBS_ANGUILLA/tags/1.8.0"
                arrSVNExternalsPreviousSolutionTag=await getArrExternals(oSolution.previous.tagUrl,svnOptions); //oPreviousSolutionTag.tagUrl
                fs.writeFileSync("./previous_externals_raw.json", JSON.stringify(arrSVNExternalsPreviousSolutionTag, null, 2));
                
                // logNewLine('getting externals from solution trunk', 'gray');
                // arrSVNExternalsCurrentSolutionTag=await getArrExternals(remoteRepo);

                logNewLine(`determine difference between ${oSolution.previous.tagNumber} and ${oSolution.current.tagNumber}`, 'gray');
                //difference
                arrExt = arrSVNExternalsCurrentSolutionTag.filter(x => !arrSVNExternalsPreviousSolutionTag.includes(x));
                fs.writeFileSync("./externals_difference_raw.json", JSON.stringify(arrSVNExternalsPreviousSolutionTag, null, 2));
                //intersection: result can be used as filter on internals since we want ALL internals except for the ones that correspond with unmodified tagged components 
                arrIntFilter = arrSVNExternalsCurrentSolutionTag.filter(x => arrSVNExternalsPreviousSolutionTag.includes(x));
                fs.writeFileSync("./externals_insersection_raw.json", JSON.stringify(arrSVNExternalsPreviousSolutionTag, null, 2));

                arrIntFilter.forEach(function (entry) {
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
                
                if (name !== "") {
                    arrInternalsFilter.push({
                        key: name
                    })                    
                };
            });

                

            } else {
                //logNewLine('getting externals', 'gray');
                //svn_externals = await svnPropGetPromise('svn:externals', remoteRepo, svnOptions);                
                arrExt = arrSVNExternalsCurrentSolutionTag
            }



            arrSVNExternalsPreviousSolutionTag.forEach(function (entry) {
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
                    arrPreviousExternals.push({
                        key: name,
                        path: decodeURI(path),
                        version: entry.split('/')[entry.split('/').length-2],
                    })                    
                };
            });

                            
            var arrExternals = [];
            arrExt.forEach(function (entry) {
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
                        componentName : getComponentName(decodeURI(path.split('/').slice(0, partsToKeep).join('/')).replace('//', '/')),
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
            const svn_internals = await svnListPromise(oSolution.current.tagUrl);                        
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
                entry.componentName = currentSolution.functionalName + ' ' + entry.key;

                entry.componentBaseFolder = svnAndApp + repo + '/' + angloSVNPath + '/' + entry.key;

                isTagged = decodeURI(entry.path).toLocaleLowerCase().includes('/tags/');
                isBranched = decodeURI(entry.path).toLocaleLowerCase().includes('/branches/');
                isTrunk = decodeURI(entry.path).toLocaleLowerCase().includes('/trunk/');
            });
            let arrInternals = svn_internals.list.entry;
            //svn_internals.filter() => {arrInternalsFilter}
            arrNewInternals = arrInternals.filter(x => arrInternalsFilter.find(y => (y.key !== x.key.replace(new RegExp(" - specific", "ig"),''))));
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
                arrAll = arrAll.filter(x => tagReportArray[0].componentCollection.find(y => (y.component == x.key)));
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
            if (argv.component) {
                arrAll = arrAll.filter(project => project.key.includes(argv.component))
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
        if (!argv.tagReport&&argv.tagReportExecution&&!argv.solutionTagReport) { actions.push('   [M]issing project detection') };
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

                        let bExternalComponent = (entry.isExternal && entry.isCoreComponent);
                        let bInternalComponent = (argv.solutionTagReport && entry.isInternal);
                        if (bExternalComponent || bInternalComponent) {                                                       

                            
                            //determine from/to for svn logs. 
                            //for bExternalComponent: look at the changes since the previous tag of the active component base folder, ie from tags/1.9.0/SC ABC to trunk/SC ABC
                            let oFrom,oTo;
                            
                            if(bExternalComponent){
                                //from
                                //ie https://domain/svn/MBS_ANGLO/Benefit_Account/tags
                                //let sListURL = `"${baseURL}${entry.componentBaseFolder}/tags"`;
                                let previousVersion='';
                                let oPreviousVersion = arrPreviousExternals.find(e => e.key === entry.key)
                                if(oPreviousVersion) previousVersion = oPreviousVersion.version
                                thisComponent = await getTag(`"${entry.local_project_repo.split('/').slice(0,-1).join('/')}"`,previousVersion);
                            } else 
                            //for bInternalComponent: look at the changes on the same component since the previous tag of the solution, ie from /mbs_anguilla/tags/1.9.0/DSC ABC - specific to /mbs_anguilla/trunk/DSC ABC - specific
                            if(bInternalComponent){
                                thisComponent = oSolution                                        
                            }                                

                            //check if component already added to arrComponents 
                            if ( arrComponents.indexOf(entry.componentName) === -1) {
                                
                                var bComponentLevelMajorTagNumberIncrease = false; //might be modified below
                                const cloneSvnOptions = JSON.parse(JSON.stringify(svnOptions));
                                cloneSvnOptions.revision = `${thisComponent.previous.tagRevisionNumber}:${thisComponent.current.tagRevisionNumber}`//:{${dateOfCurrentTag}} --verbose`
                                cloneSvnOptions.verbose = true
                                const logList = await svnLogPromise(`"${baseURL}${entry.componentBaseFolder}"`, cloneSvnOptions);
                                var logListEntries = logList.logentry;
                                if (logListEntries && logListEntries.length > 0) {
                                    //let bComponentWasChangedSincePreviousTag = true;
                                    logThisLine('[T]', 'green');

                                    //filter the log entries to have only commit messages with JIRA numbers
                                    regExJira = new RegExp('([A-Z][A-Z0-9]+-[0-9]+)', 'g');
                                    logListEntries = logListEntries.filter(l => l.author !== 'continuousdelivery' && regExJira.test(l.msg.toUpperCase()));
                                    //add selected entries in an custom array
                                    let arrComponentJiraCollection = [];
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
                                            if (arrComponentJiraCollection.findIndex(j => j.jiraIssueNumber === singularJiraIssueNumber) === -1) {
                                                var commitMessageString = jiraEntry.msg.replace(jiraEntry.msg.match(regExJira).toString(), '').replace(/^. |: |- |, /, '').replace(`https://jira.${profile.domain}/browse/`, '').trim()
                                                const listAllJiraAngloProjects = ['AIRD', 'AISSB', 'CONVA', 'IRD', 'MTSSSKN', 'MBSAI', 'MTSAI', 'SDTSS', 'SSB'];
                                                if (listAllJiraAngloProjects.includes(singularJiraIssueNumber.split('-')[0])) {
                                                    try {
                                                        theIssue = await jiraComponent.getJiraIssue(profile.jiraUsername, profile.jiraPassword, profile.domain, singularJiraIssueNumber);
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
                                                        arrComponentJiraCollection.push(
                                                            {
                                                                jiraIssueNumber: singularJiraIssueNumber,
                                                                jiraIssueDescription: issueSummary,
                                                                issueStatus,
                                                                commitMessages: []
                                                            }
                                                        )
                                                        logNewLine('', 'gray')
                                                        if(bExternalComponent){
                                                            logThisLine(`add:      ${bExternalComponent?entry.componentName:'internal'} / ${singularJiraIssueNumber}`, 'green')
                                                        }
                                                        if(bInternalComponent){
                                                            logThisLine(`add:      ${currentSolution.functionalName} / ${singularJiraIssueNumber}`, 'green')
                                                        }
                                                        logThisLine(`${bIssueLevelMajorTagNumberIncrease ? ' [major]' : ''}`, 'red')
                                                        arrComponentJiraCollection[arrComponentJiraCollection.length - 1].commitMessages.push(commitMessageString);
                                                    } else {
                                                        logNewLine('', 'gray')
                                                        logThisLine(`Skip: ${singularJiraIssueNumber}`, 'yellow')
                                                        logThisLine(` [${theIssue.fields.status.name}]`, 'yellow')
                                                    }
                                                } //else {
                                                  //  logNewLine('', 'gray');
                                                  //  logNewLine('Comment contains invalid or unknown JIRA project: ' + singularJiraIssueNumber, 'red');
                                                //}
                                            } else {
                                                //add commit msg to appropriate issue issue object
                                                var indexOfExistingJiraIssue = arrComponentJiraCollection.findIndex(j => j.jiraIssueNumber === singularJiraIssueNumber)
                                                if (arrComponentJiraCollection[indexOfExistingJiraIssue].commitMessages.indexOf(commitMessageString) === -1) {
                                                    arrComponentJiraCollection[indexOfExistingJiraIssue].commitMessages.push(commitMessageString)
                                                }
                                            };
                                        }
                                    }

                                    // var derivedNewTagNumber;
                                    // if(bExternalComponent) {
                                    //     if(entry.isTrunk ) {
                                    //         derivedNewTagNumber = semver.inc(oTo.tagNumber,bComponentLevelMajorTagNumberIncrease?'major':'minor')
                                    //     } else {
                                    //         derivedNewTagNumber = oTo.oCurrentRevision.tagNumber 
                                    //     }
                                    // } else
                                    // if(bInternalComponent) {
                                    //     derivedNewTagNumber = oSolution.current.tagNumber
                                    // }
                                                
                                        
                                        if (profile.verbose) {
                                            logNewLine('', 'gray');
                                            logNewLine('', 'gray');                                            
                                            logNewLine(`${entry.isTagged ? 'tag:     ':entry.isExternal?'trunk:   ':'internal:'} ${bComponentLevelMajorTagNumberIncrease?'Major':'Minor'}: ${thisComponent.previous.tagNumber} to ${thisComponent.current.tagNumber}, rev:{${thisComponent.previous.tagRevisionNumber}:${thisComponent.current.tagRevisionNumber}}, ${arrComponentJiraCollection.length} JIRA issues`, "green");
                                        }
                                        //sort jira issue alphabetically
                                        arrComponentJiraCollection.sort();

                                        const arrComponentJiraCollectionMapped = arrComponentJiraCollection.map((element) => ({                                            
                                            component: entry.componentName,
                                            ...element
                                          }));
                                          arrComponentJiraCollection = arrComponentJiraCollectionMapped;

                                        //add unique component to arrComponents
                                        arrComponents.push(entry.componentName);

                                        arrOverallJiraCollection = arrOverallJiraCollection.concat(arrComponentJiraCollection)

                                        arrTagReportCollection.push({
                                            component: entry.componentName,
                                            previousTagNumber: thisComponent.previous.tagNumber,
                                            previousTagRevisionNumber: thisComponent.previous.tagRevisionNumber,
                                            previousTagUrl: thisComponent.previous.tagRevisionNumber,
                                            currentTagNumber: thisComponent.current.tagNumber,
                                            currentTagRevisionNumber: thisComponent.current.tagRevisionNumber,
                                            previousTagUrl: thisComponent.current.previousTagUrl,
                                            tagName: bExternalComponent ? (entry.componentName):(currentSolution.functionalName + ' ' + thisComponent.current.tagNumber),
                                            jiraProjects: arrJiraProjects,
                                            numberOfJiraIssues: arrComponentJiraCollection.length,
                                            jiraIssues: arrComponentJiraCollection                                    
                                        });

                                        //logNewLine(`${bComponentLevelMajorTagNumberIncrease?'major':'minor'}: ${thisComponent.previous.tagNumber} to ${thisComponent.current.tagNumber} ${entry.isTagged ? 'is tagged': 'on trunk'}, rev:{${thisComponent.previous.tagRevisionNumber}:${thisComponent.current.tagRevisionNumber}}, ${arrComponentJiraCollection.length} JIRA issues`, "green");


                                        
                                        //write (append to new or existing file)
                                        //var filename = `${workingCopyFolder}${argv.solutionTagReport?'solution':''}tagreport_${timestampStart}`;
                                        //fs.writeFileSync(filename + '.json', JSON.stringify(arrTagReportCollection, null, 2));

                                } else logThisLine('[-]', 'gray'); // no or just 1 logentry (the tag)
                            } else logThisLine('[-]', 'gray');
                        } else {
                            logThisLine(`[-]`, 'gray');
                        }
                        //}
                    } else {
                        // tagReport not enabled
                    }
                    if (argv.tagReportExecution) {

                        if(argv.tagReportExecution.includes('solution')) {
                            console.log('solution');


                            // read the file
                        } else if(argv.tagReportExecution.includes('tagreport')) {
                            console.log('tag');
                        } else {
                            console.log('Illegal file. Either use solution or regular tag report')
                        }



                        if(false) {
                            // set reference to component object in tagReportArry                        
                            tagReportExecutionComponent = tagReportArray.find(y => (y.component == entry.key));
                            logThisLine('[E]', 'gray');
                            logNewLine('', 'gray');
                            logNewLine('', 'gray');

                            //keep array of tags already created so they will be created only once
                            
                            if(entry.isTrunk) {
                                if (tagsCreated.indexOf(entry.componentBaseFolder) === -1) {

                                    console.log(`Tagging ${entry.componentBaseFolder} with tag ${tagReportExecutionComponent.currentTagNumber}`)

                                    let svnCopyCommand = `svn copy "${baseURL}${entry.componentBaseFolder}/trunk" "${baseURL}${entry.componentBaseFolder}/tags/${tagReportExecutionComponent.currentTagNumber}" -m "${tagReportExecutionComponent.currentTagNumber}"`
                                    console.log(`${entry.componentBaseFolder}: ${svnCopyCommand}`)
                                    try {
                                        let tagResult = await execShellCommand(svnCopyCommand);
                                    } catch (error) {
                                        console.dir('Errors while executing execShellCommand(tag): ', svnCopyCommand)
                                        beep(3);
                                    }
                                    
                                    tagsCreated.push(entry.componentBaseFolder);
                                }
                            }

                            if(entry.isTrunk) {
                                let tagReportExecutionComponentLevelTagName =  entry.componentName +' '+tagReportExecutionComponent.currentTagNumber;
                                logNewLine(`${tagReportExecutionComponent.component} holding ${tagReportExecutionComponent.jiraIssues.length} issues in ${tagReportExecutionComponent.jiraProjects.length} distinct project(s)`, 'green')
                                let jiraProjecterCounter = 1;
                                for await (const jiraProject of tagReportExecutionComponent.jiraProjects) {
                                    //create fix version in each distinct project, if it not exists already
                                    logNewLine(`[${jiraProjecterCounter}/${tagReportExecutionComponent.jiraProjects.length}] adding fix version '${tagReportExecutionComponentLevelTagName}' to project '${jiraProject}'`, 'green')
                                    //perform on sample project
                                    //if (tagReportExecutionComponent.component === 'DSC Business license') {
                                        try {
                                            await jiraComponent.addVersionIfNotExists(profile.jiraUsername, profile.jiraPassword, profile.domain, jiraProject, tagReportExecutionComponentLevelTagName);
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
                                            await jiraComponent.updateJiraIssueFixVersion(profile.jiraUsername, profile.jiraPassword, profile.domain, jiraIssue.jiraIssueNumber, tagReportExecutionComponentLevelTagName);
                                        } catch (error) {
                                            console.dir('Errors while executing updateJiraIssueFixVersion: ', jiraIssue.jiraIssueNumber, tagReportExecutionComponentLevelTagName)
                                            beep(3);
                                        }
                                    //}
                                    jiraIssueCounter++;
                                }
                            }
                        }
                        //update external from current version to new tag
                    } else {
                        // tagReport exectuion not enabled
                    }
                } else {

                    if(!argv.tagReport&&argv.tagReportExecution&&!argv.solutionTagReport) {
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
            issueCount = arrTagReportCollection.map(a => a.jiraIssues.length).reduce((a, b) => a + b)
            arrTagReportSolutionCollection.push({
                solution: currentSolution.name,
                previousTagNumber: oSolution.previous.tagNumber,
                previousTagRevisionNumber: oSolution.previous.tagRevisionNumber,
                currentTagNumber: oSolution.current.tagNumber,
                currentTagRevisionNumber: oSolution.current.tagRevisionNumber,
                tagName: currentSolution.functionalName + ' ' + oSolution.current.tagNumber,                    
                numberOfComponents: arrTagReportCollection.length,                                           
                numberOfJiraIssues: issueCount,
                componentCollection: arrTagReportCollection
            });
            var filename = `${workingCopyFolder}${argv.solutionTagReport?'solution':''}_tagreport_${timestampStart}`;
    
            if (arrTagReportCollection && arrTagReportCollection.length > 0 && issueCount && issueCount > 0) {
                logNewLine(`${argv.solutionTagReport?'Solution tag ':'Tag '} report has been stored as ${filename}.json. It contains ${arrTagReportCollection.length} components and ${issueCount} issues`, 'gray');
            }

            //write (append to new or existing file)
            fs.writeFileSync(filename + '.json', JSON.stringify(arrTagReportSolutionCollection, null, 2));
            const xlsx = require("xlsx")//npm install xlsx
            var newWB = xlsx.utils.book_new()
            const excelProjectArray = arrTagReportCollection.map(({ jiraProjects, jiraIssues, wasAlreadyTagged, isMajor,...keepAttrs }) => keepAttrs)
            var objProject = excelProjectArray.map((e) => {
                return e
            })                                        
            try {
                var newWSProject = xlsx.utils.json_to_sheet(objProject)
                const excelJiraArray = arrOverallJiraCollection.map(({ commitMessages, currentFixVersions, ...keepAttrs }) => keepAttrs)
                var objIssue = excelJiraArray.map((e) => {
                    return e
                })
                var newWSIssue = xlsx.utils.json_to_sheet(objIssue)
                xlsx.utils.book_append_sheet(newWB, newWSProject, "components")
                xlsx.utils.book_append_sheet(newWB, newWSIssue, "issues")
                xlsx.writeFile(newWB, filename + ".xlsx")//file name as param                                            
            } catch (error) {
                console.dir('Errors while exporting to excel. Is file closed?')
                beep(3);
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
        //beep(1);
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
function getComponentName(componentBaseFolder){
    var p1 = componentBaseFolder.split('/')
    return (p1[p1.length-2].replaceAll('_',' ').includes('SolutionDevelopment') ? 'SC ':'DSC ') + p1[p1.length-1].replaceAll('_',' ').replace('Compliance','Compliancy').replace('SC Reallocate Payment','SC Payment reallocation')
}

//get revision info of previous trunk/tag/branch
async function getTag(url,tagNumberinPreviousSolution) {

    let bSolutionsTrunk = url.includes('trunk')

    //get list of tags of this entry
    arrUrl = url.split('/');
    svnPathPartLength = bSolutionsTrunk ? 1:2
    svnPathPart = arrUrl.splice(-svnPathPartLength);
    actualSvnTrunkBranchOrTagPart = svnPathPart[0];
    derivedSvnTrunkBranchOrTagPart = bSolutionsTrunk ? 'tags':actualSvnTrunkBranchOrTagPart
    actualSvnTrunkBranchOrTagNumberPart = svnPathPart[svnPathPart.length-1].replace('"','');
    derivedSvnTrunkBranchOrTagNumberPart = actualSvnTrunkBranchOrTagNumberPart === 'undefined' ? 0:actualSvnTrunkBranchOrTagNumberPart
    sListURL = arrUrl.join('/').replace('"','');

    const lsTagsOrBranches = await svnListPromise(`"${sListURL}/${derivedSvnTrunkBranchOrTagPart}"`);
    //create array, only of numeric tags
    arrTagsOrBranches = lsTagsOrBranches.list.entry.filter(item => !isNaN(item.name.charAt(0)));
    //properly order semantic tags on unfiltered arrTagsOrBranches
    if (arrTagsOrBranches.length > 1) {
        arrTagsOrBranchesSorted = arrTagsOrBranches.map(a => a.name.replace(/\d+/g, n => +n + 100000)).sort().map(a => a.replace(/\d+/g, n => +n - 100000));
    } else {
        //nothing to be sorted since there's only 1
        arrTagsOrBranchesSorted = arrTagsOrBranches
    }
    //force trunk in sorted array
    arrTagsOrBranchesSorted.unshift('trunk');

    indexCurrent = arrTagsOrBranchesSorted.findIndex(i => i===derivedSvnTrunkBranchOrTagNumberPart)
    currentArrTagsOrBranchesSorted = arrTagsOrBranchesSorted[indexCurrent]
    if(argv.solutionTagReport&&tagNumberinPreviousSolution&&tagNumberinPreviousSolution!==''){        
        previousArrTagsOrBranchesSorted = arrTagsOrBranchesSorted.find(e => e === tagNumberinPreviousSolution)
    } else {
        previousArrTagsOrBranchesSorted = bSolutionsTrunk ? arrTagsOrBranchesSorted[arrTagsOrBranchesSorted.length-1]:arrTagsOrBranchesSorted[indexCurrent-1]
    }
    
    let currentRevisionNumber,currentTagNumber,currentTagUrl,currentTagBaseUrl;
    let previousRevisionNumber,previousTagNumber,previousTagUrl,previousTagBaseUrl;
    let previousResultInfo;
    let currentResultInfo;

        currentResultInfo = await svnInfoPromise(url);
        
        currentRevisionNumber = currentResultInfo.entry.commit.$.revision;
        currentTagNumber = bSolutionsTrunk ? 'trunk':arrTagsOrBranches.find(i => i.name = arrTagsOrBranchesSorted[indexCurrent]).name;
        currentTagUrl = url;
        currentTagBaseUrl = sListURL;

        previousUrl = url.replace(currentArrTagsOrBranchesSorted,bSolutionsTrunk ? `${derivedSvnTrunkBranchOrTagPart}/`:'')+previousArrTagsOrBranchesSorted
        previousResultInfo = await svnInfoPromise(previousUrl);

        previousRevisionNumber = previousResultInfo.entry.commit.$.revision;
        previousTagNumber = previousArrTagsOrBranchesSorted;
        previousTagUrl = previousUrl;
        previousTagBaseUrl = sListURL;        

        oReturnObject = { 
            current: {
                tagNumber:currentTagNumber,
                tagObject:currentResultInfo,
                tagRevisionNumber:currentRevisionNumber,
                tagUrl: currentTagUrl,
                tagBaseUrl: currentTagBaseUrl,
            },
            previous: {
                tagNumber:previousTagNumber,
                tagObject:previousResultInfo,
                tagRevisionNumber:previousRevisionNumber,
                tagUrl: previousTagUrl,
                tagBaseUrl: previousTagBaseUrl,
            }
        }
        let future = {};
        if (bSolutionsTrunk) {
            futureTagNumber = semver.inc(arrTagsOrBranchesSorted[arrTagsOrBranchesSorted.length-1],'minor');
            futureTagUrl = previousTagUrl.replace(previousTagNumber,futureTagNumber)
            future = {
                tagNumber:futureTagNumber,
                tagUrl: futureTagUrl,
                tagBaseUrl: currentTagBaseUrl,
            }
            oReturnObject.future = future
        }
        return oReturnObject
}

async function getArrExternals(url,svnOptions) {

    const svn_externals = await svnPropGetPromise('svn:externals', `${url}`, svnOptions);
    return svn_externals.target.property._.split("\r\n");
}
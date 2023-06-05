/* eslint-disable no-undef */
/* eslint-disable no-restricted-syntax */
const semver = require('semver');
const clargs = require('./arguments');
const consoleLog = require('./consoleLog');
const jira = require('./jira');
const promises = require('./promises');
const state = require('./state');
const svn = require('./svn');

async function perform(componentEntry) {
  const bExternalComponent = (componentEntry.isExternal && componentEntry.isCoreComponent && (componentEntry.isTrunk || clargs.argv.includeTagged) && !componentEntry.isFrontend);
  const bInternalComponent = (componentEntry.isInternal && clargs.argv.includeInternals);
  let thisComponent;
  if (bExternalComponent || bInternalComponent) {
    // for bExternalComponent: look at the changes since the previous tag of the active component base folder, ie from tags/1.9.0/SC ABC to trunk/SC ABC
    if (bExternalComponent) {
      let previousVersion = '';
      const oPreviousVersion = state.arrPreviousExternals.find((e) => e.key === componentEntry.key);
      if (oPreviousVersion) previousVersion = oPreviousVersion.version;
      thisComponent = await svn.getTag(`${componentEntry.local_project_repo.split('/').slice(0, -1).join('/')}`, previousVersion, componentEntry);
    } else
    // for bInternalComponent: look at the changes on the same component since the previous tag of the solution, ie from /mbs_anguilla/tags/1.9.0/DSC ABC - specific to /mbs_anguilla/trunk/DSC ABC - specific
    if (bInternalComponent) {
      thisComponent = state.oSolution;
    }
    // check if component already added to state.arrComponents
    if (state.arrComponents.indexOf(componentEntry.componentName) === -1) {
      let bComponentLevelMajorTagNumberIncrease = false; // might be modified below
      const cloneSvnOptions = JSON.parse(JSON.stringify(svn.svnOptions));
      // if (clargs.argv.tagReportMode === 'solution' && bExternalComponent) {
      if (bInternalComponent) {
        if (thisComponent.previous) {
          cloneSvnOptions.revision = `${thisComponent.previous.tagRevisionNumber}:${thisComponent.current.tagRevisionNumber}`;
        } else {
          cloneSvnOptions.revision = `1:${thisComponent.current.tagRevisionNumber}`;
        }
        // if (thisComponent.solutionPrevious) {
        //   cloneSvnOptions.revision = `${thisComponent.solutionPrevious.tagRevisionNumber}:${thisComponent.current.tagRevisionNumber}`;
        // } else {
        //   cloneSvnOptions.revision = `1:${thisComponent.current.tagRevisionNumber}`;
        // }
      } else if (bExternalComponent) {
        if (thisComponent.previous) {
          cloneSvnOptions.revision = `${thisComponent.previous.tagRevisionNumber}:${thisComponent.current.tagRevisionNumber}`;
        } else {
          cloneSvnOptions.revision = `1:${thisComponent.current.tagRevisionNumber}`;
        }
      } else {
        console.log(`${componentEntry.componentName} skipped`);
      }
      cloneSvnOptions.verbose = true;
      const logList = await promises.svnLogPromise(`"${state.oSVNInfo.baseURL}${componentEntry.componentBaseFolder}"`, cloneSvnOptions);
      let logListEntries = logList.logentry;
      if (logListEntries && logListEntries.length > 0) {
        // filter the log entries to have only commit messages with JIRA numbers
        // eslint-disable-next-line prefer-regex-literals
        const regExJira = new RegExp('([A-Z][A-Z0-9]+-[0-9]+)', 'g');
        logListEntries = logListEntries.filter((l) => l.author !== 'continuousdelivery' && regExJira.test(l.msg.toUpperCase()));
        // add selected entries in an custom array
        let arrComponentJiraCollection = [];
        // keep unique jira projects in separate array
        const arrJiraProjects = [];
        for await (const jiraEntry of logListEntries) {
          // add item only if it is not in the collection already
          const jiraIssueNumber = jiraEntry.msg.toUpperCase().match(regExJira).toString().trim();
          let commitMessageString;
          // eslint-disable-next-line no-restricted-syntax
          for (const singularJiraIssueNumber of jiraIssueNumber.split(',')) {
            let bIssueLevelMajorTagNumberIncrease = false;
            if (JSON.stringify(jiraEntry.paths.path).toLowerCase().includes('versioned') || JSON.stringify(jiraEntry.paths.path).toLowerCase().includes('interface definitions')) {
              bIssueLevelMajorTagNumberIncrease = true;
              bComponentLevelMajorTagNumberIncrease = true;
            }
            // add unique jira issue to object array
            if (arrComponentJiraCollection.findIndex((j) => j.jiraIssueNumber === singularJiraIssueNumber) === -1) {
              commitMessageString = jiraEntry.msg.replace(jiraEntry.msg.toUpperCase().match(regExJira).toString(), '').replace(/^. |: |- |, /, '').replace('https://jira.bearingpointcaribbean.com/browse/', '').trim();
              const listAllJiraAngloProjects = ['AIIRD', 'AISSB', 'CONVA', 'IRD', 'MTSSKN', 'MBSAI', 'MTSAI', 'SDTSS', 'SSB', 'MTSGD'];
              let theIssue;
              let issueSummary;
              let issueStatus;
              // let theEpicLink;
              let epicLink;
              if (listAllJiraAngloProjects.includes(singularJiraIssueNumber.split('-')[0])) {
                try {
                  // eslint-disable-next-line no-await-in-loop
                  theIssue = await jira.getJiraIssue(state.profile.jiraUsername, state.profile.jiraPassword, singularJiraIssueNumber);
                  // issueSummary = theIssue.data.fields.summary;
                  // issueStatus = theIssue.data.fields.status.name;
                  issueSummary = singularJiraIssueNumber;
                  issueStatus = singularJiraIssueNumber;
                  // customfield_10008 of the issue contains the epic link issue
                  epicLink = '';
                  // if (theIssue.data.fields.customfield_10008) {
                  //   // eslint-disable-next-line no-await-in-loop
                  //   // 20230203 theEpicLink = await jira.getJiraIssue(state.profile.jiraUsername, state.profile.jiraPassword, theIssue.data.fields.customfield_10008);
                  //   // 20230203epicLink = theEpicLink.data.fields.summary;
                  // }
                } catch (error) {
                  issueSummary = 'could not be retrieved due to error';
                  issueStatus = 'could not be retrieved due to error';
                }
                // add unique jira project to array
                const jiraProject = singularJiraIssueNumber.substring(0, singularJiraIssueNumber.indexOf('-'));
                if (arrJiraProjects.indexOf(jiraProject) === -1) arrJiraProjects.push(jiraProject);
                // add jira issue to object array
                arrComponentJiraCollection.push(
                  {
                    jiraIssueNumber: singularJiraIssueNumber,
                    jiraIssueDescription: issueSummary,
                    issueStatus,
                    epicLink: !epicLink ? '-' : epicLink,
                    impact: bIssueLevelMajorTagNumberIncrease,
                    commitMessages: [],
                  },
                );
              }
            } else {
              // add commit msg to appropriate issue issue object
              const indexOfExistingJiraIssue = arrComponentJiraCollection.findIndex((j) => j.jiraIssueNumber === singularJiraIssueNumber);
              // update impact when it is major
              if (bComponentLevelMajorTagNumberIncrease) {
                arrComponentJiraCollection[indexOfExistingJiraIssue].impact = bComponentLevelMajorTagNumberIncrease;
              }
              if (commitMessageString && arrComponentJiraCollection[indexOfExistingJiraIssue].commitMessages.indexOf(commitMessageString) === -1) {
                arrComponentJiraCollection[indexOfExistingJiraIssue].commitMessages.push(commitMessageString);
              }
            }
          }
        }
        // deferred output, when everhting (particularly the impact) is known
        if (arrComponentJiraCollection.length > 0) {
          consoleLog.logThisLine('[T]', 'green');
          consoleLog.logNewLine('', 'gray');
        } else {
          consoleLog.logThisLine('[T]', 'white');
        }
        for (const outputItem of arrComponentJiraCollection) {
          consoleLog.logNewLine('', 'gray');
          if (bExternalComponent) {
            consoleLog.logThisLine(`add:      ${componentEntry.componentName} / ${outputItem.jiraIssueNumber}`, 'green');
          }
          if (bInternalComponent) {
            consoleLog.logThisLine(`add:      ${state.currentSolution.functionalName} / ${outputItem.jiraIssueNumber}`, 'green');
          }
          consoleLog.logThisLine(`${outputItem.impact ? ' [major]' : ''}`, 'red');
        }

        if (arrComponentJiraCollection.length > 0) {
          // getTag has already been called, but future version was determined inpredictably because the impact was not known in that stage. Overwrite it here when necessary
          let derivedNewTagNumber;
          if (bExternalComponent && !thisComponent.future) {
            if (componentEntry.isTrunk) {
              const storeTagNumber = thisComponent.previous.tagNumber;
              if (thisComponent.previous.tagNumber.split('.').length > 3) {
                thisComponent.previous.tagNumber = thisComponent.previous.tagNumber.split('.').splice(0, 3).join('.');
              }
              // if (!semver.valid(thisComponent.previous.tagNumber) thisComponent.previous.tagNumber.split('.').length
              derivedNewTagNumber = semver.inc(semver.coerce(thisComponent.previous.tagNumber), bComponentLevelMajorTagNumberIncrease ? 'minor' : 'patch');
              // if specified, increase component number to given tagReportMinimumSemVer
              if (clargs.argv.tagReportMinimumSemVer) {
                if (semver.lt(derivedNewTagNumber, clargs.argv.tagReportMinimumSemVer)) {
                  consoleLog.logThisLine(`[forced semver increment] ${storeTagNumber}=>${clargs.argv.tagReportMinimumSemVer}`, 'blue');
                  derivedNewTagNumber = clargs.argv.tagReportMinimumSemVer;
                }
              }
              thisComponent.future.tagNumber = derivedNewTagNumber;
              const t = thisComponent.future.tagUrl.split('/');
              t[t.length - 1] = derivedNewTagNumber;
              thisComponent.future.tagUrl = t.join('/');
            }
          }

          // output tag info
          if (state.profile.verbose) {
            consoleLog.logNewLine('', 'gray');
            if (state.oSolution.previous) {
              if (clargs.argv.tagReportMode === 'solution' && thisComponent.toBeTagged) {
                // eslint-disable-next-line no-nested-ternary
                const newVersion = semver.inc(semver.coerce(thisComponent.future.tagNumberToUpdateLater), bComponentLevelMajorTagNumberIncrease ? 'minor' : 'patch');
                thisComponent.future.tagUrl = thisComponent.future.tagUrl.replace(thisComponent.future.tagNumber, newVersion);
                thisComponent.future.tagNumber = newVersion;
                consoleLog.logNewLine(`${componentEntry.isTagged ? 'tag:     ' : componentEntry.isExternal ? 'trunk:   ' : 'internal:'} From ${componentEntry.solutionPrevious ? thisComponent.solutionPrevious.tagNumber : state.oSolution.previous.tagNumber} to ${Object.prototype.hasOwnProperty.call(thisComponent, 'future') ? thisComponent.future.tagNumber : thisComponent.current.tagNumber}, rev:{${thisComponent.solutionPrevious ? thisComponent.solutionPrevious.tagRevisionNumber : state.oSolution.previous.tagRevisionNumber}:${thisComponent.current.tagRevisionNumber}}, ${arrComponentJiraCollection.length} JIRA issues`, 'green');
              } else if (clargs.argv.tagReportMode === 'component') {
                // eslint-disable-next-line no-nested-ternary
                consoleLog.logNewLine(`${componentEntry.isTagged ? 'tag:     ' : componentEntry.isExternal ? 'trunk:   ' : 'internal:'} From ${componentEntry.previous ? thisComponent.previous.tagNumber : state.oSolution.previous.tagNumber} to ${Object.prototype.hasOwnProperty.call(thisComponent, 'future') ? thisComponent.future.tagNumber : thisComponent.current.tagNumber}, rev:{${thisComponent.previous ? thisComponent.previous.tagRevisionNumber : state.oSolution.previous.tagRevisionNumber}:${thisComponent.current.tagRevisionNumber}}, ${arrComponentJiraCollection.length} JIRA issues`, 'green');
              }
            }
          }
          // sort jira issue alphabetically
          arrComponentJiraCollection.sort();
          const arrComponentJiraCollectionMapped = arrComponentJiraCollection.map((element) => ({
            component: componentEntry.componentName,
            ...element,
          }));
          arrComponentJiraCollection = arrComponentJiraCollectionMapped;
          // add unique component to state.arrComponents
          state.arrComponents.push(componentEntry.componentName);
          state.arrOverallJiraCollection = state.arrOverallJiraCollection.concat(arrComponentJiraCollection);
          const componentTagNumber = Object.prototype.hasOwnProperty.call(thisComponent, 'future') ? thisComponent.future.tagNumber : thisComponent.current.tagNumber;
          let componentTagName = '';
          if (bExternalComponent) {
            componentTagName = `${componentEntry.componentName} ${componentTagNumber}`;
          } else {
            componentTagName = `${state.currentSolution.functionalName} ${componentTagNumber}`;
          }
          state.arrTagReportCollection.push({
            component: componentEntry.componentName,
            bareComponentName: componentEntry.bareComponentName,
            toBeTagged: thisComponent.toBeTagged,
            previousComponentTagNumber: thisComponent.previous ? thisComponent.previous.tagNumber : 'N/A',
            previousComponentTagRevisionNumber: thisComponent.previous ? thisComponent.previous.tagRevisionNumber : 1,
            previousComponentTagUrl: thisComponent.previous ? thisComponent.previous.tagUrl : thisComponent.current.tagUrl,
            currentComponentTagNumber: thisComponent.current.tagNumber,
            currentComponentTagRevisionNumber: thisComponent.current.tagRevisionNumber,
            currentComponentTagUrl: thisComponent.current.tagUrl,
            componentTagName,
            componentTagNumber,
            componentTagBaseUrl: thisComponent.current.tagBaseUrl,
            componentTagSourceUrl: thisComponent.current.tagUrl,
            componentTagTargetUrl: Object.prototype.hasOwnProperty.call(thisComponent, 'future') ? thisComponent.future.tagUrl : thisComponent.current.tagUrl,
            jiraProjects: arrJiraProjects,
            numberOfJiraIssues: arrComponentJiraCollection.length,
            jiraIssues: arrComponentJiraCollection,
          });
        }
      } else consoleLog.logThisLine('[-]', 'gray'); // no or just 1 logentry (the tag)
    } else consoleLog.logThisLine('[-]', 'gray');
  } else {
    consoleLog.logThisLine('[-]', 'gray');
  }
  // }
}
module.exports = {
  perform,
};

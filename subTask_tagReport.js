/* eslint-disable no-undef */
/* eslint-disable no-restricted-syntax */
const clargs = require('./arguments');
const consoleLog = require('./consoleLog');
const jira = require('./jira');
const promises = require('./promises');
const state = require('./state');
const svn = require('./svn');

async function perform(componentEntry) {
  const bExternalComponent = (componentEntry.isExternal && componentEntry.isCoreComponent && (componentEntry.isTrunk || clargs.argv.includeTagged));
  const bInternalComponent = (componentEntry.isInternal && clargs.argv.includeInternals);
  let thisComponent;
  if (bExternalComponent || bInternalComponent) {
    // for bExternalComponent: look at the changes since the previous tag of the active component base folder, ie from tags/1.9.0/SC ABC to trunk/SC ABC
    if (bExternalComponent) {
      let previousVersion = '';
      const oPreviousVersion = state.arrPreviousExternals.find((e) => e.key === componentEntry.key);
      if (oPreviousVersion) previousVersion = oPreviousVersion.version;
      thisComponent = await svn.getTag(`${componentEntry.local_project_repo.split('/').slice(0, -1).join('/')}`, previousVersion);
    } else
    // for bInternalComponent: look at the changes on the same component since the previous tag of the solution, ie from /mbs_anguilla/tags/1.9.0/DSC ABC - specific to /mbs_anguilla/trunk/DSC ABC - specific
    if (bInternalComponent) {
      thisComponent = state.oSolution;
    }
    // check if component already added to state.arrComponents
    if (state.arrComponents.indexOf(componentEntry.componentName) === -1) {
      let bComponentLevelMajorTagNumberIncrease = false; // might be modified below
      const cloneSvnOptions = JSON.parse(JSON.stringify(svn.svnOptions));
      cloneSvnOptions.revision = `${thisComponent.previous.tagRevisionNumber}:${thisComponent.current.tagRevisionNumber}`;// :{${dateOfCurrentTag}} --verbose`
      cloneSvnOptions.verbose = true;
      const logList = await promises.svnLogPromise(`"${state.oSVNInfo.baseURL}${componentEntry.componentBaseFolder}"`, cloneSvnOptions);
      let logListEntries = logList.logentry;
      if (logListEntries && logListEntries.length > 0) {
        // let bComponentWasChangedSincePreviousTag = true;
        consoleLog.logThisLine('[T]', 'green');
        // filter the log entries to have only commit messages with JIRA numbers
        // eslint-disable-next-line prefer-regex-literals
        const regExJira = new RegExp('([A-Z][A-Z0-9]+-[0-9]+)', 'g');
        logListEntries = logListEntries.filter((l) => l.author !== 'continuousdelivery' && regExJira.test(l.msg.toUpperCase()));
        // add selected entries in an custom array
        let arrComponentJiraCollection = [];
        // keep unique jira projects in separate array
        const arrJiraProjects = [];
        consoleLog.logNewLine('', 'gray');
        for await (const jiraEntry of logListEntries) {
          // add item only if it is not in the collection already
          const jiraIssueNumber = jiraEntry.msg.match(regExJira).toString().toUpperCase().trim();
          let commitMessageString;
          // eslint-disable-next-line no-restricted-syntax
          for (const singularJiraIssueNumber of jiraIssueNumber.split(',')) {
            let bIssueLevelMajorTagNumberIncrease = false;
            if (JSON.stringify(jiraEntry.paths.path).toLowerCase().includes('versioned') || JSON.stringify(jiraEntry.paths.path).toLowerCase().includes('interface')) {
              bIssueLevelMajorTagNumberIncrease = true;
              bComponentLevelMajorTagNumberIncrease = true;
            }
            // add unique jira issue to object array
            if (arrComponentJiraCollection.findIndex((j) => j.jiraIssueNumber === singularJiraIssueNumber) === -1) {
              commitMessageString = jiraEntry.msg.replace(jiraEntry.msg.match(regExJira).toString(), '').replace(/^. |: |- |, /, '').replace(`https://jira.${state.profile.domain}/browse/`, '').trim();
              const listAllJiraAngloProjects = ['AIRD', 'AISSB', 'CONVA', 'IRD', 'MTSSSKN', 'MBSAI', 'MTSAI', 'SDTSS', 'SSB'];
              let theIssue; let issueSummary; let issueStatus;
              if (listAllJiraAngloProjects.includes(singularJiraIssueNumber.split('-')[0])) {
                try {
                  // eslint-disable-next-line no-await-in-loop
                  theIssue = await jira.getJiraIssue(state.profile.jiraUsername, state.profile.jiraPassword, state.profile.domain, singularJiraIssueNumber);
                  issueSummary = theIssue.data.fields.summary;
                  issueStatus = theIssue.data.fields.status.name;
                } catch (error) {
                  issueSummary = 'could not be retrieved due to error';
                  issueStatus = 'could not be retrieved due to error';
                }
                const listUnwantedJiraIssueStates = []; // 'Ready for development', 'In test', 'On hold'
                if (!listUnwantedJiraIssueStates.includes(theIssue.data.fields.status.name)) {
                  // add unique jira project to array
                  const jiraProject = singularJiraIssueNumber.substring(0, singularJiraIssueNumber.indexOf('-'));
                  if (arrJiraProjects.indexOf(jiraProject) === -1) arrJiraProjects.push(jiraProject);
                  // add jira issue to object array
                  arrComponentJiraCollection.push(
                    {
                      jiraIssueNumber: singularJiraIssueNumber,
                      jiraIssueDescription: issueSummary,
                      issueStatus,
                      commitMessages: [],
                    },
                  );
                  consoleLog.logNewLine('', 'gray');
                  if (bExternalComponent) {
                    consoleLog.logThisLine(`add:      ${bExternalComponent ? componentEntry.componentName : 'internal'} / ${singularJiraIssueNumber}`, 'green');
                  }
                  if (bInternalComponent) {
                    consoleLog.logThisLine(`add:      ${state.currentSolution.functionalName} / ${singularJiraIssueNumber}`, 'green');
                  }
                  consoleLog.logThisLine(`${bIssueLevelMajorTagNumberIncrease ? ' [major]' : ''}`, 'red');
                  arrComponentJiraCollection[arrComponentJiraCollection.length - 1].commitMessages.push(commitMessageString);
                } else {
                  consoleLog.logNewLine('', 'gray');
                  consoleLog.logThisLine(`Skip: ${singularJiraIssueNumber}`, 'yellow');
                  consoleLog.logThisLine(` [${theIssue.data.fields.status.name}]`, 'yellow');
                }
              } // else {
              //  consoleLog.logNewLine('', 'gray');
              //  consoleLog.logNewLine('Comment contains invalid or unknown JIRA project: ' + singularJiraIssueNumber, 'red');
              // }
            } else {
              // add commit msg to appropriate issue issue object
              const indexOfExistingJiraIssue = arrComponentJiraCollection.findIndex((j) => j.jiraIssueNumber === singularJiraIssueNumber);
              if (commitMessageString && arrComponentJiraCollection[indexOfExistingJiraIssue].commitMessages.indexOf(commitMessageString) === -1) {
                arrComponentJiraCollection[indexOfExistingJiraIssue].commitMessages.push(commitMessageString);
              }
            }
          }
        }
        // let derivedNewTagNumber;
        // if(bExternalComponent) {
        //     if(componentEntry.isTrunk ) {
        //         derivedNewTagNumber = semver.inc(oTo.tagNumber,bComponentLevelMajorTagNumberIncrease?'major':'minor')
        //     } else {
        //         derivedNewTagNumber = oTo.oCurrentRevision.tagNumber
        //     }
        // } else
        // if(bInternalComponent) {
        //     derivedNewTagNumber = state.oSolution.current.tagNumber
        // }
        if (state.profile.verbose) {
          consoleLog.logNewLine('', 'gray');
          // eslint-disable-next-line no-nested-ternary
          consoleLog.logNewLine(`${componentEntry.isTagged ? 'tag:     ' : componentEntry.isExternal ? 'trunk:   ' : 'internal:'} ${bComponentLevelMajorTagNumberIncrease ? 'Major' : 'Minor'}: ${thisComponent.previous.tagNumber} to ${Object.prototype.hasOwnProperty.call(thisComponent, 'future') ? thisComponent.future.tagNumber : thisComponent.current.tagNumber}, rev:{${thisComponent.previous.tagRevisionNumber}:${thisComponent.current.tagRevisionNumber}}, ${arrComponentJiraCollection.length} JIRA issues`, 'green');
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
        const tagNumber = Object.prototype.hasOwnProperty.call(thisComponent, 'future') ? thisComponent.future.tagNumber : thisComponent.current.tagNumber;
        let tagName = '';
        if (bExternalComponent) {
          tagName = `${componentEntry.componentName} ${tagNumber}`;
        } else {
          tagName = `${state.currentSolution.functionalName} ${tagNumber}`;
        }
        state.arrTagReportCollection.push({
          component: componentEntry.componentName,
          toBeTagged: thisComponent.toBeTagged,
          previousTagNumber: thisComponent.previous.tagNumber,
          previousTagRevisionNumber: thisComponent.previous.tagRevisionNumber,
          previousTagUrl: thisComponent.previous.tagRevisionNumber,
          currentTagNumber: thisComponent.current.tagNumber,
          currentTagRevisionNumber: thisComponent.current.tagRevisionNumber,
          currentTagUrl: thisComponent.current.tagUrl,
          tagName,
          tagNumber,
          tagBaseUrl: thisComponent.current.tagBaseUrl,
          tagSourceUrl: thisComponent.current.tagUrl,
          tagTargetUrl: Object.prototype.hasOwnProperty.call(thisComponent, 'future') ? thisComponent.future.tagUrl : thisComponent.current.tagUrl,
          jiraProjects: arrJiraProjects,
          numberOfJiraIssues: arrComponentJiraCollection.length,
          jiraIssues: arrComponentJiraCollection,
        });
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

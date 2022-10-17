/* eslint-disable no-restricted-syntax */
const beep = require('node-beep');
const clargs = require('./arguments');
const componentToTrunk = require('./componentToTrunk');
const consoleLog = require('./consoleLog');
const jira = require('./jira');
const state = require('./state');
const util = require('./state');

async function perform(componentEntry) {
  const bSolutionTaggingEnabled = false;
  const bSolutionJiraHandlingEnabled = false;
  const bComponentTaggingEnabled = false;
  const bComponentJiraHandlingEnabled = false;
  const bComponentSwitchExternalsEnabled = true;
  let jiraIssueCounter;
  // ------------------------------------------------------------------
  // general
  // ------------------------------------------------------------------
  const tagReportExecutionSolutionData = state.tagReportArray[0];
  const tagReportExecutionComponentData = state.tagReportArray[0].componentCollection.find((y) => (y.component === componentEntry.componentName));
  consoleLog.logThisLine('[E]', 'gray');
  consoleLog.logNewLine('', 'gray');
  consoleLog.logNewLine('', 'gray');
  // ------------------------------------------------------------------
  // solution - tagging
  // ------------------------------------------------------------------
  if (clargs.argv.tagReportExecutionMode === 'solution' && !state.bDone) {
    if (tagReportExecutionSolutionData.currentTagNumber === 'trunk') {
      // if tag not exists
      let tagExist;
      try {
        const resultInfo = await jira.jiraGet(state.profile.svnOptionsUsername, state.profile.svnOptionsPassword, `${tagReportExecutionSolutionData.tagSourceUrl}`);
        tagExist = (resultInfo.status === 200);
      } catch (error) {
        tagExist = false;
      }
      if (!tagExist) {
        consoleLog.logNewLine(`Tagging solution '${tagReportExecutionSolutionData.solution}' with tag '${tagReportExecutionSolutionData.tagName}'`, 'gray');
        const svnCopyCommand = `svn copy "${tagReportExecutionSolutionData.tagSourceUrl}" "${tagReportExecutionSolutionData.tagSourceUrl}" -m "${tagReportExecutionSolutionData.tagName}"`;
        consoleLog.logNewLine(`command: ${svnCopyCommand}`, 'gray');
        if (bSolutionTaggingEnabled) {
          try {
            await util.execShellCommand(svnCopyCommand);
          } catch (error) {
            consoleLog.logNewLine(`Errors while executing execShellCommand(tag): ${svnCopyCommand}`, 'red');
            beep(3);
          }
        }
      } else {
        consoleLog.logNewLine(`Tag already exists. Skip tagging. Continuing...${tagReportExecutionSolutionData.tagNumber}`, 'gray');
      }
    } // consoleLog.logNewLine('solution not on trunk', tagReportExecutionSolutionData.tagNumber)
    consoleLog.logNewLine('', 'gray');
    // ------------------------------------------------------------------
    // solution - jira handling
    // ------------------------------------------------------------------
    // gather unique projects from jira issues
    const arrUniqueJiraProjects = [];
    for (const components of state.tagReportArray[0].componentCollection) {
      for (const jiraProject of components.jiraProjects) {
        if (arrUniqueJiraProjects.indexOf(jiraProject) === -1) {
          arrUniqueJiraProjects.push(jiraProject);
        }
      }
    }
    let jiraProjectCounter = 1;
    for await (const jiraProject of arrUniqueJiraProjects) {
      // create fix version in each distinct project, if it not exists already
      consoleLog.logNewLine(`[${jiraProjectCounter}/${arrUniqueJiraProjects.length}] adding fix version '${tagReportExecutionSolutionData.tagName}' to project '${jiraProject}'`, 'green');
      if (bSolutionJiraHandlingEnabled) {
        try {
          await jira.addVersionIfNotExists(state.profile.jiraUsername, state.profile.jiraPassword, jiraProject, tagReportExecutionSolutionData.tagName, false);
        } catch (error) {
          consoleLog.logNewLine(`Errors while executing addVersionIfNotExists: ${jiraProject} ${tagReportExecutionSolutionData.tagName}`, 'gray');
          beep(3);
        }
      }
      jiraProjectCounter += 1;
    }
    // run only once for the whole solution
    state.bDone = true;
    consoleLog.logNewLine('', 'gray');
  }
  // for each issue in the solution, both internal and external components get the solution tag name
  jiraIssueCounter = 1;
  for await (const jiraIssue of tagReportExecutionComponentData.jiraIssues) {
    // create fix version in each issue
    consoleLog.logNewLine(`[${jiraIssueCounter}/${tagReportExecutionComponentData.jiraIssues.length}] adding fix version '${tagReportExecutionSolutionData.tagName}' to jira issue '${jiraIssue.jiraIssueNumber}'`, 'green');
    // perform on sample project
    if (bSolutionJiraHandlingEnabled) {
      try {
        await jira.updateJiraIssueFixVersion(state.profile.jiraUsername, state.profile.jiraPassword, jiraIssue.jiraIssueNumber, tagReportExecutionSolutionData.tagName);
      } catch (error) {
        consoleLog.logNewLine(`Errors while executing updateJiraIssueFixVersion: ${jiraIssue.jiraIssueNumber} ${tagReportExecutionSolutionData.tagName}`, 'gray');
        beep(3);
      }
    }
    jiraIssueCounter += 1;
  }
  // ------------------------------------------------------------------
  // solution component - tagging
  // ------------------------------------------------------------------
  if (clargs.argv.tagReportExecutionMode === 'component' || clargs.argv.tagReportExecutionMode === 'solution') {
    if (componentEntry.isTrunk && componentEntry.isExternal) {
      if (state.componentTagsCreated.indexOf(componentEntry.componentBaseFolder) === -1) {
        // if tag not exists
        let tagExist;
        try {
          const resultInfo = await jira.jiraGet(state.profile.svnOptionsUsername, state.profile.svnOptionsPassword, `${tagReportExecutionComponentData.tagTargetUrl}`);
          tagExist = (resultInfo.status === 200);
        } catch (error) {
          tagExist = false;
        }
        if (!tagExist) {
          consoleLog.logNewLine(`Tagging ${componentEntry.componentName} with tag ${tagReportExecutionComponentData.tagName}`, 'green');
          const svnCopyCommand = `svn copy "${tagReportExecutionComponentData.tagSourceUrl}" "${tagReportExecutionComponentData.tagTargetUrl}" -m "${tagReportExecutionComponentData.tagName}"`;
          consoleLog.logNewLine(`${svnCopyCommand}`, 'gray');
          if (bComponentTaggingEnabled) {
            try {
              await util.execShellCommand(svnCopyCommand);
            } catch (error) {
              consoleLog.logNewLine(`Errors while executing execShellCommand(tag): ${svnCopyCommand}`, 'gray');
              beep(3);
            }
          }
          if (bComponentSwitchExternalsEnabled) {
            try {
              // eslint-disable-next-line no-param-reassign
              const from = tagReportExecutionComponentData.tagSourceUrl.replace(state.oSVNInfo.baseURL, '/');
              const to = tagReportExecutionComponentData.tagTargetUrl.replace(state.oSVNInfo.baseURL, '/');
              await componentToTrunk.perform(componentEntry, from, to);
            } catch (error) {
              consoleLog.logNewLine(`Errors while executing execShellCommand(tag): ${svnCopyCommand}`, 'gray');
              beep(3);
            }
          }
        } else {
          consoleLog.logNewLine(`Skipping ${componentEntry.componentName}, since tag ${tagReportExecutionComponentData.tagNumber} already exists`, 'red');
        }
        state.componentTagsCreated.push(componentEntry.componentBaseFolder);
        consoleLog.logNewLine('', 'gray');
      }
    } // component not on trunk or not external
    // ------------------------------------------------------------------
    // solution component - jira handling
    // ------------------------------------------------------------------
    // jira project handling
    if (componentEntry.isTrunk && componentEntry.isExternal) {
      // let tagReportExecutionComponentData = componentEntry.componentName + ' ' + tagReportExecutionComponentData.currentTagNumber;
      consoleLog.logNewLine(`${tagReportExecutionComponentData.component} holding ${tagReportExecutionComponentData.jiraIssues.length} issues in ${tagReportExecutionComponentData.jiraProjects.length} distinct project(s)`, 'green');
      consoleLog.logNewLine('', 'gray');
      let jiraProjectCounter = 1;
      for await (const jiraProject of tagReportExecutionComponentData.jiraProjects) {
        // create fix version in each distinct project, if it not exists already
        consoleLog.logNewLine(`[${jiraProjectCounter}/${tagReportExecutionComponentData.jiraProjects.length}] adding fix version '${tagReportExecutionComponentData.tagName}' to project '${jiraProject}'`, 'green');
        if (bComponentJiraHandlingEnabled) {
          try {
            await jira.addVersionIfNotExists(state.profile.jiraUsername, state.profile.jiraPassword, jiraProject, tagReportExecutionComponentData.tagName, true);
          } catch (error) {
            consoleLog.logNewLine(`Errors while executing addVersionIfNotExists: ${jiraProject}${tagReportExecutionComponentData.tagName}`, 'gray');
            beep(3);
          }
        }
        jiraProjectCounter += 1;
      }
      consoleLog.logNewLine('', 'gray');
      // jira issue handling
      jiraIssueCounter = 1;
      for await (const jiraIssue of tagReportExecutionComponentData.jiraIssues) {
        // create fix version in each issue
        consoleLog.logNewLine(`[${jiraIssueCounter}/${tagReportExecutionComponentData.jiraIssues.length}] adding fix version '${tagReportExecutionComponentData.tagName}' to jira issue '${jiraIssue.jiraIssueNumber}'`, 'green');
        // perform on sample project
        if (bComponentJiraHandlingEnabled) {
          try {
            await jira.updateJiraIssueFixVersion(state.profile.jiraUsername, state.profile.jiraPassword, jiraIssue.jiraIssueNumber, tagReportExecutionComponentData.tagName);
          } catch (error) {
            consoleLog.logNewLine(`Errors while executing updateJiraIssueFixVersion: ${jiraIssue.jiraIssueNumber} ${tagReportExecutionComponentData.tagName}`, 'gray');
            beep(3);
          }
        }
        jiraIssueCounter += 1;
      }
    }
  } // else tagreportexecutionmode
}
module.exports = {
  perform,
};

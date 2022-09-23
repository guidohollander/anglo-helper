module.exports = {

    perform: async function () {

        let bSolutionTaggingEnabled = false;
        let bSolutionJiraHandlingEnabled = true;
        let bComponentTaggingEnabled = false;
        let bComponentJiraHandlingEnabled = false;


        if (true) {
            // ------------------------------------------------------------------
            // general
            // ------------------------------------------------------------------
            tagReportExecutionSolutionData = tagReportArray[0];
            tagReportExecutionComponentData = tagReportArray[0].componentCollection.find(y => (y.component == entry.componentName));
            logThisLine('[E]', 'gray');
            logNewLine('', 'gray');
            logNewLine('', 'gray');

            // ------------------------------------------------------------------
            // solution - tagging
            // ------------------------------------------------------------------
            if (argv.tagReportExecutionMode === 'solution' && !bDone) {
                if (tagReportExecutionSolutionData.currentTagNumber === 'trunk' || true) {

                    //if tag not exists
                    let tagExist;
                    try {
                        const resultInfo = await jiraComponent.jiraGet(profile.svnOptionsUsername, profile.svnOptionsPassword, `${tagReportExecutionSolutionData.tagSourceUrl}`);
                        tagExist = (resultInfo.status === 200);
                    } catch (error) {
                        tagExist = false;
                    }
                    if (!tagExist) {
                        console.log(`Tagging solution '${tagReportExecutionSolutionData.solution}' with tag '${tagReportExecutionSolutionData.tagName}'`)
                        let svnCopyCommand = `svn copy "${tagReportExecutionSolutionData.tagSourceUrl}" "${tagReportExecutionSolutionData.tagSourceUrl}" -m "${tagReportExecutionSolutionData.tagName}"`
                        console.log(`command: ${svnCopyCommand}`)
                        if (bSolutionTaggingEnabled) {
                            try {
                                let tagResult = await execShellCommand(svnCopyCommand);
                            } catch (error) {
                                console.dir('Errors while executing execShellCommand(tag): ', svnCopyCommand)
                                beep(3);
                            }
                        }
                    } else {
                        console.log('Tag already exists. Skip tagging. Continuing...', tagReportExecutionSolutionData.tagNumber)
                    }
                } // console.log('solution not on trunk', tagReportExecutionSolutionData.tagNumber)

                logNewLine('', 'gray')

                // ------------------------------------------------------------------
                // solution - jira handling
                // ------------------------------------------------------------------

                //gather unique projects from jira issues
                arrUniqueJiraProjects = [];
                for (const components of tagReportArray[0].componentCollection) {
                    for (const jiraProject of components.jiraProjects) {
                        if (arrUniqueJiraProjects.indexOf(jiraProject) === -1) {
                            arrUniqueJiraProjects.push(jiraProject)
                        }
                    }
                }

                let jiraProjectCounter = 1;
                for await (const jiraProject of arrUniqueJiraProjects) {
                    //create fix version in each distinct project, if it not exists already
                    logNewLine(`[${jiraProjectCounter}/${arrUniqueJiraProjects.length}] adding fix version '${tagReportExecutionSolutionData.tagName}' to project '${jiraProject}'`, 'green')
                    if (bSolutionJiraHandlingEnabled) {
                        try {
                            await jiraComponent.addVersionIfNotExists(profile.jiraUsername, profile.jiraPassword, profile.domain, jiraProject, tagReportExecutionSolutionData.tagName, false);
                        } catch (error) {
                            console.dir('Errors while executing addVersionIfNotExists: ', jiraProject, tagReportExecutionSolutionData.tagName)
                            beep(3);
                        }
                    }
                    jiraProjectCounter++;
                }
                // run only once for the whole solution
                bDone = true;

                logNewLine('', 'gray')
            }

            //for each issue in the solution, both internal and external components get the solution tag name
            let jiraIssueCounter = 1;
            for await (const jiraIssue of tagReportExecutionComponentData.jiraIssues) {
                //create fix version in each issue
                logNewLine(`[${jiraIssueCounter}/${tagReportExecutionComponentData.jiraIssues.length}] adding fix version '${tagReportExecutionSolutionData.tagName}' to jira issue '${jiraIssue.jiraIssueNumber}'`, 'green')
                //perform on sample project
                if (bSolutionJiraHandlingEnabled) {
                    try {
                        await jiraComponent.updateJiraIssueFixVersion(profile.jiraUsername, profile.jiraPassword, profile.domain, jiraIssue.jiraIssueNumber, tagReportExecutionSolutionData.tagName);
                    } catch (error) {
                        console.dir('Errors while executing updateJiraIssueFixVersion: ', jiraIssue.jiraIssueNumber, tagReportExecutionSolutionData.tagName)
                        beep(3);
                    }
                }
                jiraIssueCounter++;
            }

            // ------------------------------------------------------------------
            // solution component - tagging
            // ------------------------------------------------------------------                            
            if (argv.tagReportExecutionMode === 'component' || argv.tagReportExecutionMode === 'solution') {
                if (entry.isTrunk && entry.isExternal) {
                    if (componentTagsCreated.indexOf(entry.componentBaseFolder) === -1) {
                        //if tag not exists
                        let tagExist;
                        try {
                            const resultInfo = await jiraComponent.jiraGet(profile.svnOptionsUsername, profile.svnOptionsPassword, `${tagReportExecutionComponentData.tagTargetUrl}`);
                            tagExist = (resultInfo.status === 200);
                        } catch (error) {
                            tagExist = false;
                        }
                        if (!tagExist) {
                            logNewLine(`Tagging ${entry.componentName} with tag ${tagReportExecutionComponentData.tagName}`, 'green')
                            let svnCopyCommand = `svn copy "${tagReportExecutionComponentData.tagSourceUrl}" "${tagReportExecutionComponentData.tagTargetUrl}" -m "${tagReportExecutionComponentData.tagName}"`
                            console.log(`${svnCopyCommand}`)
                            if (bComponentTaggingEnabled) {
                                try {
                                    let tagResult = await execShellCommand(svnCopyCommand);
                                } catch (error) {
                                    console.dir('Errors while executing execShellCommand(tag): ', svnCopyCommand)
                                    beep(3);
                                }
                            }
                        } else {
                            logNewLine(`Skipping ${entry.componentName}, since tag ${tagReportExecutionComponentData.tagNumber} already exists`, 'red')
                        }
                        componentTagsCreated.push(entry.componentBaseFolder);
                        logNewLine('', 'gray')
                    }
                } // component not on trunk or not external                                
                // ------------------------------------------------------------------
                // solution component - jira handling
                // ------------------------------------------------------------------

                //jira project handling
                if (entry.isTrunk && entry.isExternal) {
                    //let tagReportExecutionComponentData = entry.componentName + ' ' + tagReportExecutionComponentData.currentTagNumber;
                    logNewLine(`${tagReportExecutionComponentData.component} holding ${tagReportExecutionComponentData.jiraIssues.length} issues in ${tagReportExecutionComponentData.jiraProjects.length} distinct project(s)`, 'green')
                    logNewLine('', 'gray');
                    let jiraProjectCounter = 1;
                    for await (const jiraProject of tagReportExecutionComponentData.jiraProjects) {
                        //create fix version in each distinct project, if it not exists already
                        logNewLine(`[${jiraProjectCounter}/${tagReportExecutionComponentData.jiraProjects.length}] adding fix version '${tagReportExecutionComponentData.tagName}' to project '${jiraProject}'`, 'green')
                        if (bComponentJiraHandlingEnabled) {
                            try {
                                await jiraComponent.addVersionIfNotExists(profile.jiraUsername, profile.jiraPassword, profile.domain, jiraProject, tagReportExecutionComponentData.tagName, true);
                            } catch (error) {
                                console.dir('Errors while executing addVersionIfNotExists: ', jiraProject, tagReportExecutionComponentData.tagName)
                                beep(3);
                            }
                        }
                        jiraProjectCounter++;
                    }

                    logNewLine('', 'gray')

                    //jira issue handling
                    let jiraIssueCounter = 1;
                    for await (const jiraIssue of tagReportExecutionComponentData.jiraIssues) {
                        //create fix version in each issue
                        logNewLine(`[${jiraIssueCounter}/${tagReportExecutionComponentData.jiraIssues.length}] adding fix version '${tagReportExecutionComponentData.tagName}' to jira issue '${jiraIssue.jiraIssueNumber}'`, 'green')
                        //perform on sample project
                        if (bComponentJiraHandlingEnabled) {
                            try {
                                await jiraComponent.updateJiraIssueFixVersion(profile.jiraUsername, profile.jiraPassword, profile.domain, jiraIssue.jiraIssueNumber, tagReportExecutionComponentData.tagName);
                            } catch (error) {
                                console.dir('Errors while executing updateJiraIssueFixVersion: ', jiraIssue.jiraIssueNumber, tagReportExecutionComponentData.tagName)
                                beep(3);
                            }
                        }
                        jiraIssueCounter++;
                    }
                }
            } // else tagreportexecutionmode 
        } // 
    }
}
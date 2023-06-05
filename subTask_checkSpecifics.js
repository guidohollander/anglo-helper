/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const consoleLog = require('./consoleLog');
const state = require('./state');
const promises = require('./promises');
const util = require('./util');

let relevantSolutions = [];

async function processLineByLine(baseToReplace, file, componentEntry) {
  const fileStream = fs.createReadStream(file);

  const rl = await readline.createInterface({
    input: fileStream,
  });
  // eslint-disable-next-line no-restricted-syntax
  for await (const line of rl) {
    if (line.toLowerCase().includes('-link>') && line.toLowerCase().includes('- specific')) {
      const firstPart = line.substring(line.indexOf('-link>') + 6);
      const linkedFilePath = firstPart.includes('#') ? firstPart.substring(0, firstPart.indexOf('#')) : firstPart.substring(0, firstPart.indexOf('<'));

      if (linkedFilePath) {
        // eslint-disable-next-line no-restricted-syntax
        for await (const sol of relevantSolutions) {
          // if iterated solution contains this component and that component also is on the trunk
          const componentEntryIndexInSol = sol.tidiedexternals.findIndex((x) => x.key === componentEntry.key);
          if (componentEntryIndexInSol !== -1 && sol.tidiedexternals[componentEntryIndexInSol].isTrunk) {
            const checkFile = path.join(sol.path, linkedFilePath);
            // if the file that is linked to in the current file of the iterated solution does not exist => warn
            if (!fs.existsSync(checkFile)) {
              consoleLog.logNewLine(`${sol.functionalName}${consoleLog.giveSpace(sol.functionalName, ' ')}: ${file.replace(baseToReplace, '')} links to ${linkedFilePath}`, 'red');
            }
          }
        }
      }
    }
  }
}

async function checkPath(folder, baseToReplace, componentEntry) {
  const bixmlContainingPaths = new Set();
  try {
    const files = await promises.globPromise(`${folder}/**/*.bixml`);
    // consoleLog.logNewLine(`checking ${files.length} files in ${relevantSolutions.length} implementations`, 'blue');
    consoleLog.logThisLine(`${files.length}/${relevantSolutions.length}]`, 'gray');
    // eslint-disable-next-line no-restricted-syntax
    for (const file of files) {
      // consoleLog.logNewLine(file, 'gray');
      // eslint-disable-next-line no-await-in-loop
      const result = await processLineByLine(baseToReplace, file, componentEntry);
      if (result) {
        // consoleLog.logNewLine(`checking ${files.length} files in ${relevantSolutions.length} implementations`, 'blue');
        consoleLog.logNewLine('', 'gray');
      }
    }
  } catch (error) {
    // console.log(error)
    consoleLog.logNewLine(error, 'gray');
  }
  return bixmlContainingPaths;
}
async function performEx(componentEntry) {
  // check the last commit to the current implementation
  // if the commit contains files commit to specific, copy (and commit?) them to the specific folder of other implementations.
  // Warn if the core component in the other implementation is not on the trunk. Maybe in the future moveComponentToTrunk first
  // contains: commit of a file in specific with links from a core component which DOES NOT EXIST in other implementations => copy, including all other specific files. Maybe also submit
  // contains: commit of a file in specific which DOES EXIST in other implementations => trigger compare
  // last commit: svn log -r COMMITTED
  // files involved in last commit, check how impact is determined
  if (componentEntry.isCoreComponent) {
    const dirCurrentImplementation = state.workingCopyFolder + componentEntry.key;
    let execCommand;
    try {
      // eslint-disable-next-line no-restricted-syntax
      for await (const sol of relevantSolutions) {
        // if iterated solution contains this component and that component also is on the trunk
        const componentEntryIndexInSol = sol.tidiedexternals.findIndex((x) => x.key === componentEntry.key);
        if (componentEntryIndexInSol !== -1 && (sol.tidiedexternals[componentEntryIndexInSol].isTrunk || true)) {
          execCommand = `winmergeU.exe "${dirCurrentImplementation}" "${sol.path + componentEntry.key}"`;
          // await util.execShellCommand(execCommand);
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.dir('Errors while executing:', execCommand);//
      util.beep(3);
    }
  }
  // cloneSvnOptions.verbose = true;
  // const logList = await promises.svnLogPromise(`"${state.oSVNInfo.baseURL}${componentEntry.componentBaseFolder}"`, cloneSvnOptions);
  // let logListEntries = logList.logentry;
  // if (logListEntries && logListEntries.length > 0) {
  // }
  // module.exports = {
  //   perform,
  // };
}
async function perform(componentEntry) {
  // solution (or better: implemenation) should be checked if: 1. it is of class mxs, not itself and the path in the solutions.json uber profile is not empty
  relevantSolutions = state.arrSolutions.filter((s) => s.class === 'MxS' && s.name !== state.currentSolution.name && s.path);
  if ((componentEntry.isCoreComponent || componentEntry.isInterfaceDefinition)) {
    consoleLog.logThisLine('[P]', 'white');
    // const bixmlFolder = anglo.unifyPath(state.workingCopyFolder) + componentEntry.key;
    // const bixmlSet = await checkPath(bixmlFolder, state.workingCopyFolder, componentEntry);
    await performEx(componentEntry);
  } else {
    consoleLog.logThisLine('[P]', 'red');
  }
}
module.exports = {
  perform,
  performEx,
};

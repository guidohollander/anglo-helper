/* eslint-disable no-restricted-syntax */
/* eslint-disable no-param-reassign */
const fs = require('fs');
// const xml2js = require('xml2js');
const xmldom = require('xmldom');
const xpath = require('xpath');
const { DOMParser } = require('xmldom');
const { XMLSerializer } = require('xmldom');

const {
  camelcase,
  capitalcase,
  constcase,
  cramcase,
  decapitalcase,
  lowercase,
  pascalcase,
  sentencecase,
  snakecase,
  spinalcase,
  uppercase,
} = require('stringcase');
const inquirer = require('inquirer');
const path = require('path');
inquirer.registerPrompt('directory', require('inquirer-select-directory'));
const clargs = require('./arguments');

const cloneObject = {};

const confirmAnswerValidator = async (input) => {
  // eslint-disable-next-line no-control-regex
  const re = /^[^\s^\x00-\x1f\\?*:"";<>|/.][^\x00-\x1f\\?*:"";<>|/]*[^\s^\x00-\x1f\\?*:"";<>|/.]+$/g;
  if (!re.test(input)) {
    return 'Incorrect folder name';
  }
  cloneObject.destinationPath = `${cloneObject.destinationFolder}\\${input}`;
  if (fs.existsSync(cloneObject.destinationPath && !(clargs.argv.cloneName))) {
    return 'Folder already exists';
  }
  return true;
};
function removeProjectPrefix(o) {
  return o.replace(/^DSC /, '').replace(/^SC /, '');
}
function removeSpaces(o) {
  return o.replaceAll(' ', '_');
}
function applyTemplate(e) {
  let retVal;
  for (const template of cloneObject.searchReplaceTemplates) {
    retVal = e.replaceAll(template.search, template.replace);
  }
  return retVal;
}
function applyFunction(keyword, functionToApply) {
  const keywordpair = keyword.split('=');
  return [functionToApply(keywordpair[0]), functionToApply(keywordpair[1])];
}
function hasWhiteSpace(s) {
  return s.indexOf(' ') >= 0;
}
function generateCases(keywords) {
  const resultSet = [];
  // add new keywords for keywords with spaces
  keywords.forEach((keyword) => {
    if (hasWhiteSpace(keyword)) {
      keywords.push(keyword.replaceAll(' ', ''));
    }
  });

  keywords.forEach((keyword) => {
    resultSet.push(applyFunction(keyword, camelcase));
    resultSet.push(applyFunction(keyword, capitalcase));
    resultSet.push(applyFunction(keyword, constcase));
    resultSet.push(applyFunction(keyword, cramcase));
    resultSet.push(applyFunction(keyword, decapitalcase));
    resultSet.push(applyFunction(keyword, lowercase));
    resultSet.push(applyFunction(keyword, pascalcase));
    resultSet.push(applyFunction(keyword, sentencecase));
    resultSet.push(applyFunction(keyword, snakecase));
    resultSet.push(applyFunction(keyword, spinalcase));
    resultSet.push(applyFunction(keyword, uppercase));
  });
  const stringArray = resultSet.map(JSON.stringify);
  const uniqueStringArray = new Set(stringArray);
  const results = Array.from(uniqueStringArray, JSON.parse);
  return results.sort((a, b) => b[0].length - a[0].length);
}
async function performRename(projectfolder, replacements) {
  // Define the function to recursively replace file content and rename files
  function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    if (filePath.includes('.bixml')) {
      // prefix to add to the functional-id element
      const prefix = cloneObject.eventPrefix ? cloneObject.eventPrefix : '';

      // parse the xml document
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/xml');

      // check if the xml document has an event element
      const eventElement = xpath.select('/event', doc)[0];
      if (eventElement) {
        // select the functional-id element and update its value with the prefix
        const functionalIdElementEvent = xpath.select('/event/functional-id', doc)[0];
        functionalIdElementEvent.textContent = prefix + functionalIdElementEvent.textContent;
      }

      // check if the xml document has an application-instrument-classification element
      const classificationElement = xpath.select('/application-instrument-classification', doc)[0];
      if (classificationElement) {
        // select the functional-id element and update its value with the prefix
        const functionalIdElementClassification = xpath.select('/application-instrument-classification/functional-id', doc)[0];
        functionalIdElementClassification.textContent = prefix + functionalIdElementClassification.textContent;
      }
      // check if the xml document has an application-instrument-classification element
      const decisionElement = xpath.select('/application-instrument-decision', doc)[0];
      if (decisionElement) {
        // select the functional-id element and update its value with the prefix
        const functionalIdElementDecision = xpath.select('/application-instrument-decision/functional-id', doc)[0];
        functionalIdElementDecision.textContent = prefix + functionalIdElementDecision.textContent;
      }
      // check if the xml document has an application-instrument-classification element
      const calculationElement = xpath.select('/application-instrument-calculator', doc)[0];
      if (calculationElement) {
        // select the functional-id element and update its value with the prefix
        const functionalIdElementCalculation = xpath.select('/application-instrument-calculator/functional-id', doc)[0];
        functionalIdElementCalculation.textContent = prefix + functionalIdElementCalculation.textContent;
      }

      // Loop through the replacement values and update the element values
      replacements.forEach(([originalValue, newValue]) => {
        // Find all elements with the original value and update their text content
        const elementsToUpdate = xpath.select(`//*[contains(text(), "${originalValue}")]`, doc);
        elementsToUpdate.forEach((element) => {
          element.textContent = element.textContent.replace(new RegExp(originalValue, 'g'), newValue);
        });
      });

      // Serialize the updated DOM object to XML and write it to the file
      const updatedXmlString = new XMLSerializer().serializeToString(doc);
      fs.writeFileSync(filePath, updatedXmlString, 'utf8');
    } else {
      // Replace content in the file
      replacements.forEach(([oldValue, newValue]) => {
        content = content.replace(new RegExp(oldValue, 'g'), newValue);
      });
      // Write the updated content to the file
      fs.writeFileSync(filePath, content, 'utf8');
    }

    // Rename the file
    const dirname = path.dirname(filePath);
    const oldName = path.basename(filePath);
    const newName = replacements.reduce((acc, [oldValue, newValue]) => acc.replace(new RegExp(oldValue, 'g'), newValue), oldName);
    const newPath = path.join(dirname, newName);
    fs.renameSync(filePath, newPath);
  }
  // Define the function to replace folder names
  function replaceInFolder(folderPath) {
  // Replace the folder name
    const dirname = path.dirname(folderPath);
    const oldName = path.basename(folderPath);
    let newName = oldName;
    if (oldName !== cloneObject.destinationName) {
      newName = replacements.reduce((acc, [oldValue, newValue]) => acc.replace(new RegExp(oldValue, 'g'), newValue), oldName);
    }
    const newPath = path.join(dirname, newName);
    fs.renameSync(folderPath, newPath);

    // Recursively replace in subfolders and files
    const entries = fs.readdirSync(newPath, { withFileTypes: true });
    entries.forEach((entry) => {
      const entryPath = path.join(newPath, entry.name);
      if (entry.isDirectory()) {
        replaceInFolder(entryPath);
      } else {
        replaceInFile(entryPath);
      }
    });
  }
  replaceInFolder(projectfolder);
}
async function perform() {
  cloneObject.sourcePath = clargs.argv.clone;
  cloneObject.destinationPaths = [];
  cloneObject.searchReplaceTemplates = [];
  await inquirer.prompt([{
    type: 'directory',
    name: 'sourcePath',
    message: 'Select which folder to clone',
    basePath: cloneObject.sourcePath,
  },
  {
    type: 'input',
    message: 'Name of the clone',
    name: 'destinationName',
    default: (question) => {
      // eslint-disable-next-line prefer-destructuring
      cloneObject.sourceName = path.normalize(question.sourcePath).split('\\').reverse()[0];
      cloneObject.destinationFolder = path.normalize(question.sourcePath).split('\\').slice(0, -1).join('\\');
      if (clargs.argv.cloneName) {
        return clargs.argv.cloneName;
      }
      return `${cloneObject.sourceName}Clone`;
    },
    validate: confirmAnswerValidator,
  },
  {
    type: 'input',
    message: 'Comma separated key/value list to additionally replace. For example ISL=NST, Good=Bad ',
    name: 'additionalReplacements',
    default: clargs.argv.cloneReplacements,
  },
  {
    type: 'confirm',
    name: 'prefixEvents',
    message: 'Prefix events?',
    default: false,
  },
  {
    type: 'input',
    message: 'Event prefix',
    name: 'eventPrefix',
    when: (answers) => answers.prefixEvents,
  },
  ]).then(async (answers) => {
    // check if selected folder has sibblings
    cloneObject.sourcePath = answers.sourcePath;
    cloneObject.destinationName = answers.destinationName;
    cloneObject.sourceInterfaceSibblingPath = (fs.existsSync(`${cloneObject.sourcePath} - Interface definitions`)) ? `${cloneObject.sourcePath} - Interface definitions` : null;
    cloneObject.sourceSpecificSibblingPath = (fs.existsSync(`${cloneObject.sourcePath} - Specific`)) ? `${cloneObject.sourcePath} - Specific` : null;
    cloneObject.sourceInterfaceParentPath = (fs.existsSync(`${cloneObject.sourcePath.replace(' - Interface definitions', '')}`)) ? `${cloneObject.sourcePath.replace(' - Interface definitions', '')}` : null;
    cloneObject.sourceProjectFilePath = (fs.existsSync(`${cloneObject.sourcePath}\\.project`)) ? `${cloneObject.sourcePath}\\.project` : null;
    cloneObject.destinationInterfaceSibblingPath = (fs.existsSync(`${cloneObject.sourcePath} - Interface definitions`)) ? `${cloneObject.destinationPath} - Interface definitions` : null;
    cloneObject.destinationSpecificSibblingPath = (fs.existsSync(`${cloneObject.sourcePath} - Specific`)) ? `${cloneObject.destinationPath} - Specific` : null;
    cloneObject.destinationInterfaceParentPath = (fs.existsSync(`${cloneObject.sourcePath.replace(' - Interface definitions', '')}`)) ? `${cloneObject.destinationPath.replace(' - Interface definitions', '')}` : null;
    cloneObject.destinationProjectFilePath = (fs.existsSync(`${cloneObject.sourcePath}\\.project`)) ? `${cloneObject.destinationPath}\\.project` : null;
    cloneObject.additionalReplacements = answers.additionalReplacements.split(',');
    cloneObject.eventPrefix = answers.eventPrefix;
    cloneObject.destinationPaths.push(
      {
        intention: 'selected project',
        source: cloneObject.sourcePath,
        destination: cloneObject.destinationPath,
      },
    );
    if (cloneObject.destinationInterfaceSibblingPath) {
      cloneObject.destinationPaths.push(
        {
          intention: 'child interface project',
          source: cloneObject.sourceInterfaceSibblingPath,
          destination: cloneObject.destinationInterfaceSibblingPath,
        },
      );
    }
    if (cloneObject.destinationSpecificSibblingPath) {
      cloneObject.destinationPaths.push(
        {
          intention: 'child specific project',
          source: cloneObject.sourceSpecificSibblingPath,
          destination: cloneObject.destinationSpecificSibblingPath,
        },
      );
    }
    if (cloneObject.destinationInterfaceParentPath && !cloneObject.destinationInterfaceSibblingPath) {
      cloneObject.destinationPaths.push(
        {
          intention: 'parent interface project',
          source: cloneObject.sourceInterfaceParentPath,
          destination: cloneObject.destinationInterfaceParentPath,
        },
      );
    }
    const replacements = answers.additionalReplacements ? answers.additionalReplacements.split(',') : [];
    replacements.push(`${cloneObject.sourceName}=${cloneObject.destinationName}`);
    replacements.push(`${removeProjectPrefix(cloneObject.sourceName)}=${removeProjectPrefix(cloneObject.destinationName)}`);

    cloneObject.searchReplaceTemplates = generateCases(replacements);

    console.log('replacement table: ', cloneObject.searchReplaceTemplates);

    // eslint-disable-next-line no-restricted-syntax
    for await (const copyableObject of cloneObject.destinationPaths) {
      if (clargs.argv.cloneName) {
        fs.rmSync(`${copyableObject.destination}`, { recursive: true, force: true });
      }
      fs.cpSync(copyableObject.source, copyableObject.destination, { recursive: true });
      // remove .svn folder from the destination
      fs.rmSync(`${copyableObject.destination}\\.svn`, { recursive: true, force: true });
      // perform the replacements
      performRename(path.resolve(copyableObject.destination), cloneObject.searchReplaceTemplates);
      console.log(`created ${copyableObject.intention} '${copyableObject.destination}'`)
    }
  });
}
module.exports = {
  perform,
};

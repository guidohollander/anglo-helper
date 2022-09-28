const inquirer = require('inquirer');
const consoleLog = require('./consoleLog');

async function perform(arr) {
  const oarrQ = arr.filter((e) => e.isExternal && e.isTagged && e.isCoreComponent);
  const arrQ = Object.values(oarrQ).map((i) => (i.key));
  const questions = [
    {
      type: 'list',
      name: 'selectComponent',
      message: 'Pick a component, any component.',
      choices: arrQ,
    }];
  await inquirer
    .prompt(questions)
    .catch((error) => {
      if (error.isTtyError) {
        consoleLog.logNewLine('Your console environment is not supported!', 'gray');
      } else {
        consoleLog.logNewLine(error);
      }
    });
}
module.exports = {
  perform,
};

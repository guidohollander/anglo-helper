/* eslint-disable no-console */
const { exec } = require('child_process');

function execShellCommand(cmd) {
  return new Promise((resolve) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.warn(error);
      }
      resolve(stdout || stderr);
    });
  });
}
module.exports = {
  execShellCommand,
};

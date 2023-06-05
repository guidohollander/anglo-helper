/* eslint-disable no-console */
const { exec } = require('child_process');
const fp = require('find-process');
const path = require('path');

const axios = require('axios');
const semver = require('semver');
const clargs = require('./arguments');
const pjson = require('./package.json');

const state = require('./state');

function beep(q) {
  //
}
function execShellCommand(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { maxBuffer: 1024 * 500 }, (error, stdout, stderr) => {
      if (error) {
        console.warn(error);
      }
      resolve(stdout || stderr);
    });
  });
}
async function getRemoteAppVersion() {
  const url = 'https://raw.githubusercontent.com/guidohollander/anglo-helper/master/package.json';
  const resp = await axios.get(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return resp.data.version;
}

async function findBeInformedProcess() {
  await fp('name', 'Be Informed AMS.exe', true).then((list) => {
    list.forEach((process) => {
      // use -data argument to be more specific in determining when be informed is running
      if (process) {
        if (JSON.stringify(process.cmd).toLowerCase().includes('-data')) {
          if (path.normalize(`${process.cmd.split(' ')[process.cmd.split(' ').findIndex((e)=>e.includes('-data'))+1].replace(/"|'/g, '')}\\`).toLocaleLowerCase() === path.normalize(state.workingCopyFolder).toLowerCase()) {
            // there's a process BI and the argument -data is identical to the working copy folder of the current path
            if (!clargs.argv.forceSVN) {
              state.beInformedRunning = true;
              state.hasMinDataArgument = true;
            }
          }
        } else if (!clargs.argv.forceSVN) {
          // there's a process BI, but there's no -data argument.
          state.beInformedRunning = true;
          state.hasMinDataArgument = false;
        }
      }
    });
  });
  // const processLookupResultList = await promises.processLookup({ command: 'Be Informed AMS.exe', psargs: state.app });
  // processLookupResultList.forEach((process) => {
  //   // use -data argument to be more specific in determining when be informed is running
  //   if (process) {
  //     if (JSON.stringify(process.arguments).toLowerCase().includes('-data')) {
  //       if (path.normalize(`${process.arguments[process.arguments.indexOf('-data') + 1]}/`).toLocaleLowerCase() === path.normalize(state.workingCopyFolder).toLowerCase()) {
  //         // there's a process BI and the argument -data is identical to the working copy folder of the current path
  //         if (!clargs.argv.forceSVN) {
  //           state.beInformedRunning = true;
  //           state.hasMinDataArgument = true;
  //         }
  //       }
  //     } else if (!clargs.argv.forceSVN) {
  //       // there's a process BI, but there's no -data argument.
  //       state.beInformedRunning = true;
  //       state.hasMinDataArgument = false;
  //     }
  //   }
  // });
}

async function getAppUpdateInfo() {
  const localVersion = pjson.version;
  const remoteVersion = await getRemoteAppVersion();
  return {
    updateAvailable: semver.gt(semver.coerce(remoteVersion), localVersion),
    localVersion,
    remoteVersion,
  };
}

function urlToFileName(url) {
  // const rgx = new RegExp('([A-Z][A-Z0-9]+-[0-9]+)', 'g');
  const rgx = new RegExp('[^a-zA-Z0-9 -]', 'gi');
  return url.replaceAll(rgx, '_').replace('__', '').toLowerCase();
}

function diffSeconds(dt2, dt1) {
  const diff = (dt2.getTime() - dt1.getTime()) / 1000;
  // diff /= 60;
  return Math.abs(Math.round(diff));
}

module.exports = {
  diffSeconds,
  execShellCommand,
  findBeInformedProcess,
  getAppUpdateInfo,
  beep,
  urlToFileName,
};

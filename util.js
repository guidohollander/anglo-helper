/* eslint-disable no-console */
const { exec } = require('child_process');
const axios = require('axios');
const semver = require('semver');
const pjson = require('./package.json');

function beep(q) {
  //
}

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
async function getRemoteAppVersion() {
  const url = 'https://raw.githubusercontent.com/guidohollander/anglo-helper/master/package.json';
  const resp = await axios.get(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return resp.data.version;
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

function diffSeconds(dt2, dt1) {
  let diff = (dt2.getTime() - dt1.getTime()) / 1000;
  // diff /= 60;
  return Math.abs(Math.round(diff));
}

module.exports = {
  diffSeconds,
  execShellCommand,
  getAppUpdateInfo,
  beep,
};

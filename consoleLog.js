const path = require('path');
const clargs = require('./arguments');
const state = require('./state');
const util = require('./util');

function mylog(t, c, lf) {
  if ((clargs.argv.workingCopyFolder) && (clargs.argv.workingCopyFolder.lenght > 0)) {
    process.stdout.write(t);
  } else {
    if (c === 'yellow') {
      process.stdout.write(`\x1b[93m${t}\x1b[39m`);
    } else if (c === 'red') {
      process.stdout.write(`\x1b[91m${t}\x1b[39m`);
    } else if (c === 'gray') {
      process.stdout.write(`\x1b[97m${t}\x1b[39m`);
    } else if (c === 'white') {
      process.stdout.write(`\x1b[97m${t}\x1b[37m`);
    } else if (c === 'green') {
      process.stdout.write(`\x1b[32m${t}\x1b[39m`);
    } else if (c === 'blue') {
      process.stdout.write(`\x1b[34m${t}\x1b[39m`);
    } else if (c === 'cyan') {
      process.stdout.write(`\x1b[36m${t}\x1b[39m`);
    }
    if (lf) {
      process.stdout.write('\n');
    }
  }
}
function logThisLine(t, c) {
  mylog(t, c, false);
}
function logNewLine(t, c) {
  mylog(t, c, true);
}
function renderTitle() {
  logNewLine('+-'.repeat((process.stdout.columns) / 4), 'gray');
  logNewLine(` = ${state.oAppContext.descriptiveName} = `, 'info', '\n');
  logNewLine('+-'.repeat((process.stdout.columns) / 4), 'gray');
  logNewLine('', 'gray');
  logNewLine(`Welcome to ${state.oAppContext.descriptiveName}!`, 'gray');
  logNewLine('', 'gray');
  logNewLine(`${state.oAppContext.descriptiveName} assists with SVN switches and SVN updates of your projects, detect any missing projects,`, 'gray');
  logNewLine('execute any general or project flyway scripts and validate the structure of Anglo specific projects.', 'gray');
  logNewLine('', 'gray');
  logNewLine(`Since this is probably the first time you're using ${state.oAppContext.descriptiveName},`, 'gray');
  logNewLine('please answer the following questions to setup your profile.', 'gray');
  logNewLine('', 'gray');
}
function renderTitleToVersion() {
  logNewLine('+-'.repeat((process.stdout.columns) / 4), 'gray');
  logNewLine(` = ${state.oAppContext.descriptiveName} = `, 'info', '\n');
  logNewLine('+-'.repeat((process.stdout.columns) / 4), 'gray');
  logNewLine('', 'gray');
  logNewLine(`Welcome to ${state.oAppContext.descriptiveName}!`, 'gray');
  logNewLine('', 'gray');
  logNewLine(`${state.oAppContext.descriptiveName} assists with moving to a particular SVN version.`, 'gray');
  logNewLine('Please pick a version from the list below using the arrow keys and press enter to update the current folder to that version.', 'gray');
  logNewLine('', 'gray');
  logNewLine('', 'gray');
}
const zeroPad = (num, places) => String(num).padStart(places, '0');
function getProgressString(c, l) {
  return `[${zeroPad(c, 3)}/${zeroPad(l, 3)}]`;
}
function embrace(s) {
  return `[${s}]`;
}
function giveSpace(stringForLength, spaceChar) {
  return spaceChar.repeat(30 - stringForLength.length);
}
function giveMoreSpace(l, spaceChar) {
  return spaceChar.repeat(l);
}
function showLegend() {
  logNewLine('', 'gray');
  logNewLine('color legend: ', 'white');
  const l = 31; const sp = ' '; let
    s = '';
  s = '[X]: no action needed';
  logNewLine(giveMoreSpace(l, sp) + s, 'white');
  s = '[X]: potential action needed';
  logNewLine(giveMoreSpace(l, sp) + s, 'yellow');
  s = '[X]: action performed';
  logNewLine(giveMoreSpace(l, sp) + s, 'green');
  s = '[X]: warning / error / attention';
  logNewLine(giveMoreSpace(l, sp) + s, 'red');
}
function showBIRunningWarning(paramBeInformedRunning) {
  if (paramBeInformedRunning) {
    logNewLine('', 'red');
    if (state.profile.autoSwitch || state.profile.autoUpdate) {
      if (state.hasMinDataArgument) {
        logNewLine(`Warning: Be Informed seems to be running ${(state.currentSolution.functionalName)}! Regarding svn [U]pdate and [S]witch: Only "detection" possible, indicated by [Š]/[Ŭ]`, 'red');
      } else {
        logNewLine(`Warning: Be Informed is running, but ${state.oAppContext.descriptiveName} is unable to determine to which working folder it is targeted. Start Be Informed with -data argument or ${state.oAppContext.descriptiveName} with --forceSVN (caution). Regarding svn [U]pdate and [S]witch: Only "detection" possible, indicated by [Š]/[Ŭ]`, 'red');
      }
    }
  }
}
async function showHeader() {
  let s;
  const sp = ' ';
  s = 'project folder';
  logNewLine(`${s}:${giveSpace(s, sp)}${embrace(state.workingCopyFolder.toLowerCase())}`, 'cyan');
  s = 'repo';
  logNewLine(`${s}:${giveSpace(s, sp)}${embrace(state.oSVNInfo.remoteRepo.toLowerCase())}`, 'cyan');
  s = 'application';
  logNewLine(`${s}:${giveSpace(s, sp)}${embrace(state.app)}`, 'cyan');
  s = 'profile';
  logNewLine(`${s}:${giveSpace(s, sp)}[${state.profile.filename}: [S]witch]:${state.profile.autoSwitch} | [U]pdate:${state.profile.autoUpdate} | [F]lyway:${state.profile.flyway} | [C]ompare specific:${state.profile.compareSpecific}`, 'cyan');
  s = 'über profile';
  logNewLine(`${s}:${giveSpace(s, sp)}${embrace(`${path.dirname(state.workingCopyFolder)}/.anglo-helper/solutions.json`)}`, 'cyan');
  s = `${state.oAppContext.descriptiveName.toLowerCase()} version`;
  // logNewLine(`${s}:${giveSpace(s, sp)}${embrace(state.oAppContext.version)}`, 'cyan');

  const appUpdateInfo = await util.getAppUpdateInfo();
  logThisLine(`${s}:${giveSpace(s, sp)}${embrace(state.oAppContext.version)}`, 'cyan');
  if (appUpdateInfo.updateAvailable) {
    logThisLine(` new version ${appUpdateInfo.remoteVersion} available`, 'red');
  } else {
    logThisLine(' @latest', 'green');
  }
  logNewLine('', 'gray'); logNewLine('', 'gray');

  if ((state.oSVNInfo.repo.includes('branches') || (state.oSVNInfo.repo.includes('tags'))) && state.profile.flyway && !clargs.argv.flyway) {
    state.profile.flyway = false;
    logNewLine('', 'white');
    logNewLine(`The current workspace points to a tag/branch. ${state.oAppContext.descriptiveName} disabled profile setting 'Flyway', as it might have undesireable effects on the database. To enable, use command line option --flyway.`, 'red');
  }
}
module.exports = {
  logThisLine,
  logNewLine,
  renderTitle,
  renderTitleToVersion,
  getProgressString,
  embrace,
  giveSpace,
  showHeader,
  showLegend,
  showBIRunningWarning,
};

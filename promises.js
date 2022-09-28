const util = require('util');
const svnUltimate = require('node-svn-ultimate');
const ps = require('ps-node');
const glob = require('glob');

module.exports = {
  svnInfoPromise: util.promisify(svnUltimate.commands.info),
  svnPropGetPromise: util.promisify(svnUltimate.commands.propget),
  svnListPromise: util.promisify(svnUltimate.commands.list),
  svnSwitchPromise: util.promisify(svnUltimate.commands.switch),
  svnCleanUpPromise: util.promisify(svnUltimate.commands.cleanup),
  svnUpdatePromise: util.promisify(svnUltimate.commands.update),
  svnStatusPromise: util.promisify(svnUltimate.commands.status),
  svnMergePromise: util.promisify(svnUltimate.commands.merge),
  svnLogPromise: util.promisify(svnUltimate.commands.log),
  svnPropSetPromise: util.promisify(svnUltimate.commands.propset),
  processLookup: util.promisify(ps.lookup),
  globPromise: util.promisify(glob),
};

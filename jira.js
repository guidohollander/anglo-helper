const axios = require('axios');
const consoleLog = require('./consoleLog');

const jiraPost = async (username, password, method, url, data) => {
  try {
    const config = {
      method,
      url,
      headers: {
        Authorization: `Basic ${Buffer.from(`${username}:${password}`, 'binary').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      data,
    };
    const resp = await axios(config);
    return resp.data;
  } catch (err) {
    consoleLog.logNewLine(err, 'gray');
  }
  return -1;
};
// intend: create a new version for a particular project, if necessary
async function updateJiraIssueFixVersion(jiraUsername, jiraPassword, jiraIssueNumber, fixVersion) {
  const data = `{"update":{"fixVersions":[{"add":{"name":"${fixVersion}"}}]}}`;
  const result = await jiraPost(jiraUsername, jiraPassword, 'put', `https://jira.bearingpointcaribbean.com/rest/api/latest/issue/${jiraIssueNumber}`, data);
  if (result.self) {
    consoleLog.logNewLine('Updated', result.self, 'gray');
    return result.self;
  }
  return -1;
}
const jiraGet = async (username, password, url) => {
  try {
    const resp = await axios.get(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${username}:${password}`, 'binary').toString('base64')}`,
        'Content-Type': 'application/json',
      },
    }, {
      auth: {
        username,
        password,
      },
    });
    return resp;
  } catch (err) {
    // console.error(err);
    // consoleLog.logNewLine(`Error getting data for ${url}`, 'gray');
  }
  return -1;
};
async function getJiraIssue(jiraUsername, jiraPassword, jiraIssueNumber) {
  return jiraGet(jiraUsername, jiraPassword, `https://jira.bearingpointcaribbean.com/rest/api/latest/issue/${jiraIssueNumber}`);
}
// intend: create a new version for a particular project, if necessary
async function addVersionIfNotExists(jiraUsername, jiraPassword, project, versionToAdd, bReleased) {
  // get all versions of project and check if name already exists
  const versions = await jiraGet(jiraUsername, jiraPassword, `https://jira.bearingpointcaribbean.com/rest/api/latest/project/${project}/versions`);
  // check if project fixverison exists
  if (versions.data.findIndex((element) => (element.name === versionToAdd)) === -1) {
    const data = JSON.stringify({
      archived: false,
      releaseDate: new Date().toISOString().replaceAll('T', '').replaceAll(':', '')
        .substring(0, 10),
      name: versionToAdd,
      projectId: versions.data[0].projectId,
      released: bReleased,
    });
    const result = await jiraPost(jiraUsername, jiraPassword, 'post', 'https://jira.bearingpointcaribbean.com/rest/api/latest/version', data);
    if (result.self) {
      consoleLog.logNewLine('Added', result.self);
      return result.self;
    }
  }
  return -1;
}
module.exports = {
  updateJiraIssueFixVersion,
  getJiraIssue,
  jiraGet,
  jiraPost,
  addVersionIfNotExists,
};

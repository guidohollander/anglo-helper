var baseURL;
var restApi = 'rest/api/latest';
var apiTopic = 'issue';
var jira; //the jira api
const axios = require('axios');
// intend: create a new version for a particular project, if necessary
async function updateJiraIssueFixVersion(jiraUsername, jiraPassword, domain, jiraIssueNumber, fixVersion) {
      var data = `{"update":{"fixVersions":[{"add":{"name":"${fixVersion}"}}]}}`;
      var result = await jiraPost(jiraUsername, jiraPassword, 'put',`https://jira.${domain}/rest/api/latest/issue/${jiraIssueNumber}`, data);
      if (result.self) {
          console.log('Updated', result.self);
          return result.self
      }
  }
async function getJiraIssue(jiraUsername, jiraPassword, domain, jiraIssueNumber) {
  return await jiraGet(jiraUsername, jiraPassword, `https://jira.${domain}/rest/api/latest/issue/${jiraIssueNumber}`)  
}
const jiraGet = async (username, password, url) => {
  try {
    const resp = await axios.get(url, {
      'headers': {
        'Authorization': 'Basic ' + Buffer.from(username + ":" + password, 'binary').toString('base64'),
        'Content-Type': 'application/json'
      }
    }, {
      auth: {
        username: username,
        password: password
      }
    });
    return resp
  } catch (err) {
      //console.error(err);
    logNewLine(`Error getting data for ${url}`,'gray')
  }
};
const jiraPost = async (username, password, method, url, data) => {
  try {
    var config = {
      method: method,
      url: url,
      headers: { 
        'Authorization': 'Basic ' + Buffer.from(username + ":" + password, 'binary').toString('base64'),
        'Content-Type': 'application/json'
      },
      data : data
    };
    const resp = await axios(config);
    return resp.data
  } catch (err) {
    console.error(err);
  }
};
// intend: create a new version for a particular project, if necessary
async function addVersionIfNotExists(jiraUsername, jiraPassword, domain, project, versionToAdd, bReleased) {
    //set default
    if(!bReleased) bReleased=false;
    //get all versions of project and check if name already exists
    versions = await jiraGet(jiraUsername, jiraPassword, `https://jira.${domain}/rest/api/latest/project/${project}/versions`)
    //check if project fixverison exists
    if (versions.data.findIndex(element => (element.name === versionToAdd)) === -1) {
        var data = JSON.stringify({
            "archived": false,
            "releaseDate": new Date().toISOString().replaceAll('T', '').replaceAll(':', '').substring(0, 10),
            "name": versionToAdd,
            "projectId": versions.data[0].projectId,
            "released": bReleased
        });
        var result = await jiraPost(jiraUsername, jiraPassword, 'post',`https://jira.${domain}/rest/api/latest/version`, data);
        if (result.self) {
            console.log('Added', result.self);
            return result.self
        }
    }
}
module.exports = {
  updateJiraIssueFixVersion: updateJiraIssueFixVersion,
  getJiraIssue: getJiraIssue,
  jiraGet: jiraGet,
  jiraPost : jiraPost,
  addVersionIfNotExists : addVersionIfNotExists
}
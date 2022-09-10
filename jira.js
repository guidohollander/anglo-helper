var baseURL;
var restApi = 'rest/api/latest';
var apiTopic = 'issue';
var jira; //the jira api
const axios = require('axios');

function updateJiraIssueFixVersion(jiraIssueNumber, fixVersion) {
  var request = require('request');
  var Cookie = require('request-cookies').Cookie;
  request.get(`${baseURL}/${restApi}/${apiTopic}/${jiraIssueNumber}`, function (err, response, body) {
    var rawcookies = response.headers['set-cookie'];
    for (var i in rawcookies) {
      var cookie = new Cookie(rawcookies[i]);
      var options = {
        'method': 'PUT',
        'url': `${baseURL}${restApi}/${apiTopic}/${jiraIssueNumber}`,
        'headers': {
          'Authorization': 'Basic ' + Buffer.from(username + ":" + password, 'binary').toString('base64'),
          'Content-Type': 'application/json',
          'Cookie': cookie
        },
        body: JSON.stringify({ "update": { "fixVersions": [{ "set": [{ "name": fixVersion }] }] } })
      };
      request(options, function (error, response) {
        if (error) throw new Error(error);
        console.log(response.body);
      });
    }
  });
}

async function getJiraIssue(jiraUsername, jiraPassword, jiraIssueNumber) {
  return await jiraGet(jiraUsername, jiraPassword, `https://jira.bearingpointcaribbean.com/rest/api/latest/issue/${jiraIssueNumber}`)  
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
    //console.log(resp.data);
    return resp.data
  } catch (err) {
    // Handle Error Here
    console.error(err);
  }
};

const jiraPost = async (username, password, url, data) => {
  try {

    var config = {
      method: 'post',
      url: 'https://jira.bearingpointcaribbean.com/rest/api/latest/version',
      headers: { 
        'Authorization': 'Basic ' + Buffer.from(username + ":" + password, 'binary').toString('base64'),
        'Content-Type': 'application/json'
      },
      data : data
    };

    const resp = await axios(config);
    return resp.data
  } catch (err) {
    // Handle Error Here
    console.error(err);
  }
};


function updateJiraIssueFixVersion(jiraIssueNumber, fixVersion) {
  var request = require('request');
  var Cookie = require('request-cookies').Cookie;
  request.get(`${baseURL}/${restApi}/${apiTopic}/${jiraIssueNumber}`, function (err, response, body) {
    var rawcookies = response.headers['set-cookie'];
    for (var i in rawcookies) {
      var cookie = new Cookie(rawcookies[i]);
      var options = {
        'method': 'PUT',
        'url': `${baseURL}${restApi}/${apiTopic}/${jiraIssueNumber}`,
        'headers': {
          'Authorization': 'Basic ' + Buffer.from(username + ":" + password, 'binary').toString('base64'),
          'Content-Type': 'application/json',
          'Cookie': cookie
        },
        body: JSON.stringify({ "update": { "fixVersions": [{ "set": [{ "name": fixVersion }] }] } })
      };
      request(options, function (error, response) {
        if (error) throw new Error(error);
        console.log(response.body);
      });
    }
  });
}

// intend: create a new version for a particular project, if necessary
async function addVersionIfNotExists(jiraUsername, jiraPassword, project, versionToAdd) {
    //get all versions of project and check if name already exists
    versions = await jiraGet(jiraUsername, jiraPassword, `https://jira.bearingpointcaribbean.com/rest/api/latest/project/${project}/versions`)
    //check if project fixverison exists
    if (versions.findIndex(element => (element.name === versionToAdd)) === -1) {
        //15501 = mbsai
        var data = JSON.stringify({
            "archived": false,
            "releaseDate": new Date().toISOString().replaceAll('T', '').replaceAll(':', '').substring(0, 10),
            "name": versionToAdd,
            "projectId": versions[0].projectId,
            "released": false
        });
        var result = await jiraPost(jiraUsername, jiraPassword, 'https://jira.bearingpointcaribbean.com/rest/api/latest/version', data);
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
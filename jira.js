var baseURL;
var restApi = 'rest/api/latest';
var apiTopic = 'issue';
var jira; //the jira api
const axios = require('axios');

function jira_init(username, password, baseURL) {
  baseURL = baseURL;
  var JiraApi = require('jira-client');
  jira = new JiraApi({
    protocol: 'https',
    host: 'jira.bearingpointcaribbean.com',
    username: username,
    password: password,
    apiVersion: '2',
    strictSSL: true
  });
}

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

async function getJiraIssue(jiraIssueNumber) {
  return await jira.findIssue(jiraIssueNumber)
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

module.exports = {
  jira_init: jira_init,
  updateJiraIssueFixVersion: updateJiraIssueFixVersion,
  getJiraIssue: getJiraIssue,
  jiraGet: jiraGet
}
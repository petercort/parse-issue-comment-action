const core = require('@actions/core');
const github = require('@actions/github');
const YAML = require('yaml');

let octokit = null;

async function run() {
    const commentId = core.getInput('comment_id', {required: true});
    const parserFormat = core.getInput('format', {required: true});
    try {
        const commentBody = await getCommentBody(commentId);
        const result = parseBody(commentBody);
        
        if (result != null) {
            core.setOutput('content', result);
        } else {
            core.setFailed(`The comment with id ${commentId} did not contain a valid ${parserFormat} payload.`)
        }
    } catch (err) {
        core.setFailed(err);
    }
}

run();

function getOctokit() {
    if (octokit == null) {
      const token = core.getInput('github_token', {required: true});
  
      if (!token) {
        core.error('Failed to provide a GitHub token for accessing the REST API.');
      }
  
      octokit = github.getOctokit(token);
    }
    return octokit;
  }


function getCommentBody(commentId) {
    const octokit = getOctokit();

    return octokit.rest.issues.getComment({
        ...github.context.repo,
        comment_id: commentId
    }).then(result => {
        if (result.status !== 200) {
            throw new Error(`Unexpected status code [ ${result.status} ] while fetching comment with id ${commentId}.`);
        }
        return result.data.body;
    }).catch(err => {
        core.error(err);
        throw err;
    });
}

function getBodyPayloadRegex(payload) {
    const marker = core.getInput('marker');

    let header = payload;
    if (marker && marker.length > 0) {
      header = `${payload}.*${marker}`;
    }
  
    const regexString = `\`\`\`${header}([\\s\\S]*?)\`\`\``;
  
    return new RegExp(regexString, 'igm');
  }

function parseBody(bodyContent) {
    const format = core.getInput('format', {required: true});
  
    const matched = getBodyPayloadRegex(format).exec(bodyContent);
    if (!matched) {
      core.error(`Failed to find parsable ${format} data in issue body: '${JSON.stringify(bodyContent)}'`);
      return null;
    }
  
    try {
      const result = parseExtractedData(format, matched[1]);
      return result;
    } catch (err) {
      core.error(err);
      throw new Error(`Failed to parse data payload as ${format}: '${JSON.stringify(bodyContent)}'`);
    }
  }

  function parseExtractedData(format, stringData) {
    if (format === 'json') {
      // Will throw an error on parsing if content is not valid
      return JSON.parse(stringData);
    } else if (format === 'yaml' || format === 'yml') {
      // Will throw an error on parsing if content is not valid
      return YAML.parse(stringData);
    } else {
      throw new Error(`Unsupported Format: ${format}.`);
    }
  }
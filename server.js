
const { Octokit, App } = require('octokit');
const express = require('express');
const config = require('./config.json');
const path = require('path');
const app = express();
const port = process.env.PORT || 8080;
app.listen(port);
app.use(express.static("public"));


const octokit = new Octokit({
  auth: config.githubToken
})


const queryMarkers = {
  RegexMatchQuery: 0,
  SimilarityMatchQuery: 1
}


async function getFileInDirectory(userName, repoName, path) {
  const url = "GET /repos/{owner}/{repo}/contents/{path}";
  const goodStatusNumber = 200;
  const result = await octokit.request(url, {
    owner: userName,
    repo: repoName,
    path: path
  });
  var isResolved = (result["status"] == goodStatusNumber);
  var files = [];
  if (isResolved) {
    for (const fileData of result["data"]) {
      files.push({ "name": fileData["name"], "link_path": fileData["html_url"], "api_path": fileData["path"], "is_dir": (fileData["type"] === "dir") });
    }
    return Promise.resolve(files);
  }
  else {
    return Promise.reject([]);
  }

}
//Returns true iff levenshtein distance b/w two string is less than x percent of the size of the maximum sized
//string
function getEditDistance(inputString, valueString) {
  var editDistance = new Array(inputString.length + 1);
  for (var rowId = 0; rowId <= inputString.length; rowId++) {
    editDistance[rowId] = new Array(valueString.length + 1);
  }
  for (var i = 0; i <= inputString.length; i++) {
    editDistance[i][0] = i;
  }
  for (var j = 0; j <= valueString.length; j++) {
    editDistance[0][j] = j;
  }
  //editDistance[i][j] = min(costOfOp3 + editDistance[i-1][j], 
  //                         costofOp2 + editDistance[i][j-1]
  //                         costOfOp + editDistance[i-1][j-1])
  //

  for (var i = 1; i <= inputString.length; i++) {
    for (var j = 1; j <= valueString.length; j++) {
      var currInputChar = inputString.charAt(i - 1);
      var currValueChar = valueString.charAt(j - 1);
      editDistance[i][j] = Math.min(1 + editDistance[i - 1][j], 1 + editDistance[i][j - 1],
        (currInputChar === currValueChar ? 0 : 1) + editDistance[i - 1][j - 1]);
    }
  }
  return editDistance[inputString.length][valueString.length];

}

function processCurrFileBasedOnQuery(queryType
  , regex, similarityString, file, filePaths) {
  var fileName = file["name"];
  var fileNameSize= fileName.length;
  if (queryType === queryMarkers.RegexMatchQuery) {
    var matches = fileName.match(regex);
    if(matches != null){
      for (const match of matches) {
        if (match.length === fileNameSize) {
          filePaths.push([file["link_path"], file["name"]]);
        }
      }
    }
  }
  else if (queryType === queryMarkers.SimilarityMatchQuery) {
    filePaths.push([((fileNameSize - getEditDistance(similarityString, file["name"])) * 100) / fileNameSize, file["link_path"], file["name"]]);
  }
  return;
}

async function dfs(userName, repoName, pathName, regex, queryType, similarityString, fileCounts, filePaths, requestsStatus) {
  return getFileInDirectory(userName, repoName, pathName)
    .then(async (files) => {
      for (const file of files) {
        var newPath = file["api_path"];
        processCurrFileBasedOnQuery(queryType, regex, similarityString, file, filePaths);
        if (file["is_dir"]) {
          var subtreeCall = await dfs(userName, repoName, newPath, regex, queryType, similarityString, fileCounts, filePaths, requestsStatus);
        }

      }
      return Promise.resolve();
    }
    )
    .catch(() => {
      requestsStatus[0] = false;
      return Promise.resolve();
    });
}


async function getMatchingFiles(req, queryType) {
  const userName = req.params["userName"];
  const repoName = req.params["repoName"];
  const regex = new RegExp((queryType === queryMarkers.RegexMatchQuery ? req.params["regex"] : null), 'g');
  var fileCounts = [req.params["counts"]];
  const queryId = req.params["queryId"];
  var filePaths = [];
  var requestsStatus = [true];
  const similarityString = (queryType === queryMarkers.SimilarityMatchQuery ? req.params["similarityString"] : null);
  return dfs(userName, repoName, '', regex, queryType, similarityString, fileCounts, filePaths, requestsStatus)
    .then(() => {
      if (queryType === queryMarkers.SimilarityMatchQuery) {
        filePaths.sort((a, b) => {
          if (a[0] === b[0]) {
            return 0;
          }
          else {
            return (a[0] > b[0]) ? -1 : 1;
          }
        });

        //filePaths where for each filePath[i] editDistance entry is remove
        normalizedFilePaths = []
        for (const file of filePaths) {
          const fileName = file[2];
          const filePath = file[1];
          normalizedFilePaths.push([filePath, fileName]);
        }

        filePaths = normalizedFilePaths;
      }
      while (filePaths.length > fileCounts) {
        filePaths.pop();
      }

      return [requestsStatus, filePaths, queryId];
    })
    .catch(() => [false, [], queryId]);
}

app.get('/fetchByRegex/:userName/:repoName/:regex/:counts/:queryId', async (req, res) => {
  getMatchingFiles(req, queryMarkers.RegexMatchQuery)
    .then((result) => res.send(result))
    .catch((result) => res.send(result));
})

app.get('/fetchBySim/:userName/:repoName/:similarityString/:counts/:queryId', async (req, res) => {
  getMatchingFiles(req, queryMarkers.SimilarityMatchQuery)
    .then((result) => res.send(result))
    .catch((result) => res.send(result));
})


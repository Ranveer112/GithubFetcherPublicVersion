"use strict";


(function () {
    window.addEventListener("load", init);
    const idAndClassNames = {
        submitButton: ".submit",
        functionalitySwitchButton: ".functionalitySwitch",
        textBox: ".textBoxes",
        userName: "#username",
        repoName: "#reponame",
        count: "#count",
        textInput: "#regexOrSimilarityString",
        output: ".output"
    }
    let anticipatedQueryType;//{0 for regex match, 1 for similariy match
    let latestQueryId = 0; //denotes the id for the latest query
    const queryMarkers = {
        RegexMatchQuery: 0,
        SimilarityMatchQuery: 1
    }
    const errorMessage = "There was some error(check input), the results might be incomplete!"
    const emptyInputMessage = "Any input cannot be empty, please enter it."

    function init() {
        anticipatedQueryType = queryMarkers.RegexMatchQuery;
        document.querySelector(idAndClassNames.submitButton).addEventListener("click", fetchDirectories);
        document.querySelector(idAndClassNames.functionalitySwitchButton).addEventListener("click", changeView);

    }
    //take data from forms and make the appropriate request
    async function fetchDirectories() {
        latestQueryId++;
        const form = document.querySelector(idAndClassNames.textBox).children[0];
        let outputForm = document.querySelector(idAndClassNames.output);
        let url = "";
        const userName = form.querySelector(idAndClassNames.userName).value;
        const repoName = form.querySelector(idAndClassNames.repoName).value;
        const count = form.querySelector(idAndClassNames.count).value;
        if (anticipatedQueryType === queryMarkers.RegexMatchQuery) {
            const regex = form.querySelector(idAndClassNames.textInput).value;
            url = "fetchByRegex" + "/" + userName + "/" + repoName + "/" + regex + "/" + count + "/" + latestQueryId;
            if (Math.min(userName.length, repoName.length, count.length, regex.length) === 0) {
                alert(emptyInputMessage);
                return;
            }
        }
        else {
            const similarityString = form.querySelector(idAndClassNames.textInput).value;
            url = "fetchBySim" + "/" + userName + "/" + repoName + "/" + similarityString + "/" + count + "/" + latestQueryId;
            if (Math.min(userName.length, repoName.length, count.length, similarityString.length) === 0) {
                alert(emptyInputMessage);
                return;
            }

        }
        console.log(url);
        outputForm.innerHTML = "";
        let list = document.createElement("ul");
        const serverRequest =
            fetch(url)
                //there could potentially still be error but 
                //the status is in result[0]
                .then((result) => result.json())
                .then((result) => {
                    if (latestQueryId === parseInt(result[2])) {
                        if (result[0][0] === false) {
                            alert(errorMessage);
                        }
                        else {
                            for (const file of result[1]) {
                                const fileLink = file[0];
                                const fileName = file[1];
                                let currentPoint = document.createElement("li");
                                let currentEntry = document.createElement("a");
                                currentEntry.href = fileLink;
                                currentEntry.textContent = fileName;
                                currentPoint.appendChild(currentEntry);
                                list.appendChild(currentPoint);
                            }
                            outputForm.appendChild(list);
                        }
                    }
                    return [];

                })
                //some error occured
                .catch((result) => {

                    if (latestQueryId === parseInt(result[2])) {
                        alert(errorMessage);
                    }
                });

    }
    //change anticicipated QueryType and change the display content
    //of the functionalitySwitchButton 
    function changeView() {
        anticipatedQueryType ^= 1;
        const form = document.querySelector(idAndClassNames.textBox).children[0];
        const functionalitySwitchButton = document.querySelector(idAndClassNames.functionalitySwitchButton);
        if (anticipatedQueryType === queryMarkers.SimilarityMatchQuery) {
            form.children[6].textContent = "SimilarityString";
            functionalitySwitchButton.textContent = "Fetch by pattern";
        }
        else {
            form.children[6].textContent = "Regex";
            functionalitySwitchButton.textContent = "Fetch by similarity";
        }
    }
})();
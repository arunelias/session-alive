var contextualIdentities = {};

/**
 * Closes the popup window.
 */
document.getElementById('close').addEventListener('click', function () {
  window.close();
});

/**
 * Opens the help page in a new tab.
 */
document.getElementById('help').addEventListener('click', () => {
  const helpUrl = browser.runtime.getURL('views/installed.html');
  browser.tabs.create({ url: helpUrl });
});

/**
 * Opens the extension's options page and closes the popup.
 */
document.getElementById('settings').addEventListener('click', function () {
  browser.runtime.openOptionsPage();
  window.close();
});

/**
 * Sends a message to the background script to add a rule for the current page.
 */
document.getElementById('add-rule-current-page').addEventListener('click', function () {
  //Request Add a Rule for Current Page to Background script
  browser.runtime.sendMessage({ event: "Add-Rule-Current-Page" });
});

/**
 * Cancels a running rule by its key.
 * @param {string} key - The ID of the rule to cancel.
 */
function cancelRunningRuleByKey(key) {
  //Request Cancel Rule to Background script
  browser.runtime.sendMessage({ event: "Cancel", rule_id: key })
    .then(handleMessage)
    .catch(error => { console.error("Failed to cancel the running rule:", error); });
}

/**
 * Handles the display of running rules in the popup's table.
 * @param {Object} rules - An object containing the running rules, with rule IDs as keys.
 */
function handleRunningRules(rules) {
  var runningRules = rules;
  var totRunningRules = Object.keys(runningRules).length;//Get No. of Running Rules
  var aliveRuleRow, aliveRuleRowData, aliveRuleRowDataElem, timeoutVal;
  var ruleTable = document.getElementById('rules-table');
  var ruleListingNode = document.getElementById('running-rule-listing');
  var noRuleInfo = document.getElementById('no-rules');
  // If Rules Running Display Table
  if (totRunningRules > 0) {
    //Display Rule Table
    ruleTable.style.display = "block";
    //Hide No Rules Running Info
    noRuleInfo.style.display = "none";
    // Clear the listing by removing nodes
    ruleListingNode.innerHTML = '';
    // Iterate through the keys in runningRules Object
    for (var key in runningRules) {
      if (runningRules.hasOwnProperty(key)) {
        //console.log(key + " -> " + runningRules[key]);
        aliveRuleRow = document.createElement('tr');
        //Rule Name <td>
        aliveRuleRowData = document.createElement('td');
        aliveRuleRowData.className = "rule-name-td nowrap-text";
        aliveRuleRowData.textContent = runningRules[key].rule_name;
        aliveRuleRowData.title = runningRules[key].run_uri;
        aliveRuleRowData.appendChild(document.createTextNode('\u00A0'));
        aliveRuleRow.appendChild(aliveRuleRowData);
        //contextualIdentities <td>
        aliveRuleRowData = document.createElement('td');
        aliveRuleRowData.className = "rule-usercontext-td";
        if (contextualIdentities.length && runningRules[key].cookieStoreId) {
          for (let identity of contextualIdentities) {
            if (identity.cookieStoreId == runningRules[key].cookieStoreId) {
              aliveRuleRowData.title = identity.name;
              // aliveRuleRowData.style.backgroundImage = `url("${identity.iconUrl}")`;
              // aliveRuleRowData.style.fill = identity.color;
              // aliveRuleRowData.dataset.identityColor = identity.color;
              aliveRuleRowData.style.backgroundColor = identity.colorCode;
              aliveRuleRowData.style.maskImage = `url("${identity.iconUrl}")`;
              aliveRuleRowData.style.maskRepeat = "no-repeat";
              aliveRuleRowData.style.maskPosition = "center";
              aliveRuleRowData.style.maskSize = "contain";
            }
          }
        }
        aliveRuleRow.appendChild(aliveRuleRowData);
        //Interval <td>
        aliveRuleRowData = document.createElement('td');
        aliveRuleRowData.className = "text-center";
        if (runningRules[key].runMode == "foreground") { aliveRuleRowData.title = "Foreground Rule Interval"; timeoutVal = parseInt(runningRules[key].fg_interval, 10); }
        else if (runningRules[key].runMode == "background") { aliveRuleRowData.title = "Background Rule Interval"; timeoutVal = parseInt(runningRules[key].loop_interval, 10); }
        aliveRuleRowData.textContent = timeoutVal.toString() + " m";
        aliveRuleRow.appendChild(aliveRuleRowData);
        //LastRun <td>
        aliveRuleRowData = document.createElement('td');
        aliveRuleRowData.className = "text-center";
        aliveRuleRowData.title = "Rule Last Run Time";
        aliveRuleRowData.textContent = runningRules[key].last_run;
        aliveRuleRow.appendChild(aliveRuleRowData);
        //Run Count <td>
        aliveRuleRowData = document.createElement('td');
        aliveRuleRowData.className = "text-center";
        aliveRuleRowData.title = "Rule Run Count";
        aliveRuleRowData.textContent = runningRules[key].run_count;
        aliveRuleRow.appendChild(aliveRuleRowData);
        //Cancel button <td>
        aliveRuleRowData = document.createElement('td');
        aliveRuleRowData.className = "text-center";
        aliveRuleRowDataElem = document.createElement('button');
        aliveRuleRowDataElem.className = "btn-close";
        aliveRuleRowDataElem.title = "Cancel Rule";
        aliveRuleRowDataElem.id = key;
        aliveRuleRowDataElem.dataset.id = key;
        // Add Event Listener to click event of the Rule Cancel
        aliveRuleRowDataElem.addEventListener('click', function () { cancelRunningRuleByKey(this.dataset.id); });
        aliveRuleRowData.appendChild(aliveRuleRowDataElem);
        aliveRuleRow.appendChild(aliveRuleRowData);
        //Append to Node
        ruleListingNode.appendChild(aliveRuleRow);
      }
    }
  }
  else {
    //Display Rule Table
    ruleTable.style.display = "none";
    //Display No Rules Running Info
    noRuleInfo.style.display = "block";
  }
}

/**
 * Handles messages received from other scripts (e.g., background script).
 * @param {Object} request - The message object containing the event and data.
 * @param {Object} sender - The sender object containing information about the message source.
 * @param {Function} sendResponse - The function to send a response back to the sender.
 */
function handleMessage(request, sender, sendResponse) {
  console.log("Other Scripts => Popup Script: Event: " + request.event);
  // console.log(request);
  if (request.event == "Running-rules-list") {//Got Running Rules list
    handleRunningRules(request.rules);
  }
}

/**
 * Handles tab update events and requests running rules from the background script.
 * @param {number} tabId - The ID of the updated tab.
 * @param {Object} changeInfo - The changes applied to the tab.
 * @param {Object} tabInfo - The updated tab information.
 */
function handleUpdated(tabId, changeInfo, tabInfo) {
  //Request Running rules details from background script
  browser.runtime.sendMessage({ event: "Running-rules" })
    .then(handleMessage);
}

/**
 * Initializes contextual identities for the popup.
 * @returns {Promise<void>} A promise that resolves when identities are initialized.
 */
function initIdentities() {
  if (browser.contextualIdentities !== undefined) {
    browser.contextualIdentities.query({}).then((identities) => {
      if (!identities.length) { console.log("contextualIdentities: No identities returned from the API."); }
      else { contextualIdentities = identities; }
    });
  }
}

/**
 * Initializes the popup by setting up contextual identities, messaging, and translations.
 */
function initPopup() {
  //Initialize Contextual Identities
  initIdentities();
  // Send a ping message to check Background script is ready
  browser.runtime.sendMessage({ event: "ping" })
    .then(response => {
      if (response && response.status === "ready") {
        // Background script is ready, now send the actual message
        browser.runtime.sendMessage({ event: "Running-rules" })
          .then(handleMessage)
          .catch(error => { console.error("Failed to fetch running rules:", error); });
      } else {
        console.error("Background script not ready yet.");
      }
    }).catch(error => { console.error("Ping failed:", error); });

  // Apply localized/translated strings
  translate();
}

/**
 * Listener for messages from other scripts.
 */
browser.runtime.onMessage.addListener(handleMessage);

/**
 * Listener for tab update events.
 */
browser.tabs.onUpdated.addListener(handleUpdated);

/**
 * Detects and applies the light or dark theme based on system preferences.
 */
if (window.matchMedia) {
  document.documentElement.setAttribute('data-bs-theme', (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    document.documentElement.setAttribute('data-bs-theme', event.matches ? "dark" : "light");
  });
}
//Call Initialize
initPopup();
var contextualIdentities = {};
/*
 * Add Event Listner for Close button
*/
document.getElementById('close').addEventListener('click', function(){
    window.close();
});
/*
 * Add Event Listner for Settings button
*/
document.getElementById('settings').addEventListener('click', function(){
    browser.runtime.openOptionsPage();
    window.close();
});
/*
 * Add Event Listner for Add a Rule for Current Page button
*/
document.getElementById('add-rule-current-page').addEventListener('click', function(){
  //Request Add a Rule for Current Page to Background script
  browser.runtime.sendMessage({event: "Add-Rule-Current-Page"});
  //window.close();
});
/*
 * Cancel the running rule by (key)
 *
 * @param {key} rule_id as key of Running Rules Object
 */
function cancelRunningRuleByKey(key) {
	//Request Cancel Rule to Background script
  browser.runtime.sendMessage({event: "Cancel", rule_id:key});
}
/*
 * Handle Running Rules list message from Background Script
 *
 * @param {rules} runningRules Object, 
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
    while (ruleListingNode.lastChild) {
      ruleListingNode.removeChild(ruleListingNode.lastChild);
    }
    // Iterate through the keys in runningRules Object
    for (var key in runningRules) {
      if (runningRules.hasOwnProperty(key)) {
        //console.log(key + " -> " + runningRules[key]);
        	aliveRuleRow = document.createElement('tr');
        	//Rule Name <td>
          aliveRuleRowData = document.createElement('td');
          aliveRuleRowData.className = "rule-name-td";
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
                aliveRuleRowData.style.backgroundImage = `url("${identity.iconUrl}")`;
                aliveRuleRowData.style.fill = identity.color;
                aliveRuleRowData.dataset.identityColor = identity.color;
              }
            }
          }
          aliveRuleRow.appendChild(aliveRuleRowData);
          //Interval <td>
          aliveRuleRowData = document.createElement('td');
        	if (runningRules[key].runMode == "foreground") { aliveRuleRowData.title = "Foreground Rule Interval"; timeoutVal = parseInt(runningRules[key].fg_interval, 10); }
        	else if (runningRules[key].runMode == "background") { aliveRuleRowData.title = "Background Rule Interval"; timeoutVal = parseInt(runningRules[key].loop_interval, 10); }
        	aliveRuleRowData.textContent = timeoutVal.toString() + " m";
        	aliveRuleRow.appendChild(aliveRuleRowData);
        	//LastRun <td>
          aliveRuleRowData = document.createElement('td');
          aliveRuleRowData.title = "Rule Last Run Time";
        	aliveRuleRowData.textContent = runningRules[key].last_run;
        	aliveRuleRow.appendChild(aliveRuleRowData);
        	//Run Count <td>
          aliveRuleRowData = document.createElement('td');
          aliveRuleRowData.title = "Rule Run Count";
        	aliveRuleRowData.textContent = runningRules[key].run_count;
        	aliveRuleRow.appendChild(aliveRuleRowData);
        	//Cancel button <td>
        	aliveRuleRowData = document.createElement('td');
        	aliveRuleRowDataElem = document.createElement('button');
          aliveRuleRowDataElem.className = "close";
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
/*
 * Handle Messages from Other Scripts
 *
 * @param {request} Request Event, Request Rule id, Ajax Status and Tab Ajax Response URL
 * @param {sender} Tabs.tab Object, 
 * @param {sendResponse} Response message object
*/
function handleMessage(request, sender, sendResponse) {
  console.log("Other Scripts => Popup Script: Event: " + request.event );
  if(request.event == "Running-rules-list") {//Got Running Rules list
    handleRunningRules(request.rules);
  }
}
/*
 * Tab Events - Tab Update handle
*/
function handleUpdated(tabId, changeInfo, tabInfo) {
  //Request Running rules details from background script
  browser.runtime.sendMessage({event: "Running-rules"});
}
/*
 * Contextual Identities initialize
 * @param {} nil 
*/
function initIdentities() {
  if (browser.contextualIdentities !== undefined) {
    browser.contextualIdentities.query({}).then((identities) => {
      if (!identities.length) { console.log("contextualIdentities: No identities returned from the API."); }
      else { contextualIdentities = identities; }
    });
  }
}
/*
 * Popup Script initialize
 * @param {} nil 
*/
function initPopup() {
  //Initialize Contextual Identities
  initIdentities();
	//Request Running rules details from background script
  browser.runtime.sendMessage({event: "Running-rules"});
  // Apply localized/translated strings
  translate();
}
/*
** Add Listener to Handle the message from Content Script
*/
browser.runtime.onMessage.addListener(handleMessage);
/*
** Add Listener to Handle the Tab Update [onUpdated]
*/
browser.tabs.onUpdated.addListener(handleUpdated);
//Call Initialize
initPopup();
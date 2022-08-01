"use strict";
// console.clear();

var aliveRules = {};
var runningRules = {};
var totRunningRules = 0;
const APPLICABLE_PROTOCOLS = ["http:", "https:"];
const REGEXP_WILDCARD = /(\*)/g;
const REGEXP_ESCAPE = /[.+\-?^${}()|[\]\\]/g;
/*
 * Returns true only if the URL's protocol is in APPLICABLE_PROTOCOLS.
 * @param {url} URL to check
*/
function protocolIsApplicable(url) {
  var anchor = new URL(url);
  return APPLICABLE_PROTOCOLS.includes(anchor.protocol);
}
/*
 * Returns domain name of the URL
 * @param {url} URL
*/
function getDomainName(url) {
  var anchor = new URL(url);
  return anchor.host;
}
/*
 * Display Notifications
 *
 * @param {data} tabId for notification id, notification title, and notification message
*/
function displayNotifications(data){
    var tabId = (data.tabId) ? (data.tabId.toString() + "-" + Date.now()) : "";
    chrome.notifications.create(tabId, {
        "type": "basic",
        "iconUrl": "assets/icon/icon.png",
        "title": data.title,
        "message": data.message
      });
}
/**
 * Get Time in String Format
 *
 * @param {} nil
 */
function getTimeStr() {
  var d = new Date();
  var hr = d.getHours();
  var min = d.getMinutes();
  if (min < 10) { min = "0" + min; }
  var ampm = "AM";
  if( hr > 12 ) { hr -= 12; ampm = "PM";}
  if (hr < 10) { hr = "0" + hr; }
  return hr + ":" + min + " " + ampm;
}
function onError(e) {console.error(`Error: ${e}`);}
/*
** Store or Update of the Rule Successful
*/
function setItem() {
  console.log("Store Settings Successful!");
  displayNotifications({title: "Add a Rule", message: "Rule saved successfully!"});
}
/*
 * Update Browser Badge with the total Number of Running Rules
 *
 * @param {} nil
*/
function updateBadge() {
  var totRunningRules = Object.keys(runningRules).length;//Get No. of Running Rules
  if (totRunningRules > 0) { chrome.action.setBadgeText({text: totRunningRules.toString()}); }
  else { chrome.action.setBadgeText({text: ""}); }
}
/*
 * Update Rules to the Local Variable aliveRules
 *
 * @param {aliveSettings} Session Alive Settings
*/
function updateRules(aliveSettings) {aliveRules = aliveSettings;}
/*
 * Update Session Variable to the Local Variable runningRules
 *
 * @param {aliveSession} Session Alive Session Variables
*/
function updateVariables(aliveSession) {runningRules = aliveSession;}
/*
 * Delete Rules from the runningRules object by key
 *
 * @param {key} key of runningRules object
*/
function deleteRulesByKey(key) {
  // Return if no Running Rules
  totRunningRules = Object.keys(runningRules).length;
  var senderTab = runningRules[key].tabId;
  var notificationTitle, notificationMessage;
  if (totRunningRules === 0) { return null; }
  // Check rule is already running in another tab or not
  if (runningRules[key].runMode == "foreground") {
    if (runningRules[key].notif_fgexit === true) {
      notificationTitle = "Page auto-reload rule: " + runningRules[key].rule_name;
      notificationMessage = "Foreground page auto-reload Rule stopped!";
      displayNotifications({tabId: senderTab, title: notificationTitle, message: notificationMessage});
    }
  }
  if (runningRules[key].runMode == "background") {
    if (runningRules[key].notif_bgexit === true) {
      notificationTitle = "Background request rule: " + runningRules[key].rule_name;
      notificationMessage = "Background Request Rule stopped! The server response was not 200 OK!";
      displayNotifications({tabId: senderTab, title: notificationTitle, message: notificationMessage});
    }
  }
  // Delete runningRules Object by key
  delete runningRules[key];
  // Save variable to Session
  chrome.storage.session.clear()
  .then(() => { chrome.storage.session.set(runningRules); });
  //Update Browser Badge
  updateBadge();
}
/*
 * Update Rules when Settings are updated
 *
 * @param {} nil
*/
function handleStorageChange() {
  var updateAliveRules = chrome.storage.local.get();
  updateAliveRules.then(updateRules, onError);
}
/*
 * Handle the Running Rules
 *
 * @param {tab} Tab id, and Tab URL
*/
function handleRunningRules(tab) {
  var responseMsg = {};
  var invalidMsg = {response: "Invalid Settings"};
  var timeoutVal, uri, loopUriVal, bg_triggerUriVal, bg_triggerUriMatch, fg_loopUriVal, headRequest, reloadSound, tab_cookieStoreId, tab_domain;
  uri = tab.url.replace(/\/$/, '').toLowerCase();
  tab_cookieStoreId = (tab.cookieStoreId === undefined) ? "" : tab.cookieStoreId;
  tab_domain = getDomainName(uri);// Get Domain name for supporting Wildcard URLs
  totRunningRules = Object.keys(runningRules).length;//Get No. of Running Rules
  if (totRunningRules === 0) { return null; }
  // Iterate through the keys in runningRules Object
  for (var key in runningRules) {
    if (runningRules.hasOwnProperty(key)) {
      loopUriVal =  (runningRules[key].loop_uri && runningRules[key].loop_uri !== "") ? runningRules[key].loop_uri : runningRules[key].trigger_uri;
      bg_triggerUriVal = runningRules[key].trigger_uri;
      fg_loopUriVal =  runningRules[key].fg_trigger_uri.replace(/\/$/, '').toLowerCase();
      // Check rule is already running in another tab or not
      if (runningRules[key].runMode == "foreground" && fg_loopUriVal !== "" && uri.length >= fg_loopUriVal.length && uri.indexOf(fg_loopUriVal) === 0 && runningRules[key].cookieStoreId == tab_cookieStoreId) {
        if (runningRules[key].tabId != tab.id && runningRules[key].domain == tab_domain) { responseMsg = {response: "Rule already running"}; return responseMsg;}
      }
      // Background Trigger URL matching
      bg_triggerUriMatch = false;
      if (runningRules[key].runMode == "background" && bg_triggerUriVal !== "" && bg_triggerUriVal.indexOf('*') >= 0) {// Wildcard present in Trigger URL
        let re = new RegExp(bg_triggerUriVal.replace(/\/$/, '').replace(/\/\*$/, '*').toLowerCase().replace(REGEXP_ESCAPE, '\\$&').replace(REGEXP_WILDCARD, '\.$1'));
        bg_triggerUriMatch = re.test(uri);
        loopUriVal =  (runningRules[key].loop_uri && runningRules[key].loop_uri !== "") ? runningRules[key].loop_uri : uri;
      }
      else if (runningRules[key].runMode == "background" && bg_triggerUriVal !== "") {
        bg_triggerUriMatch = (bg_triggerUriVal.replace(/\/$/, '').toLowerCase() == uri);
      }
      if (bg_triggerUriMatch && runningRules[key].cookieStoreId == tab_cookieStoreId && runningRules[key].domain == tab_domain) {
        if (runningRules[key].tabId != tab.id) { responseMsg = {response: "Rule already running"}; return responseMsg;}
      }
      //Confirm call is from the tab which is Running the Rule
      if (runningRules[key].tabId == tab.id && runningRules[key].runMode == "foreground") {
        //Tab Id found with Foreground Run Mode
        timeoutVal = parseInt(runningRules[key].fg_interval, 10);
        if (isNaN(timeoutVal) || timeoutVal === 0) { return invalidMsg; }//NaN or Zero Encountered - Return Invalid
        timeoutVal = timeoutVal * 60; //Convert to Seconds
        reloadSound = runningRules[key].fg_reload_sound;
        //Match URI with the Loop URI of the Rule
        if (uri.length >= fg_loopUriVal.length && uri.indexOf(fg_loopUriVal) === 0) {
          responseMsg = {
            response: "Run foreground rule",
            run: "foreground",
            rule_id: key,
            timeout: timeoutVal,
            beepEnabled: reloadSound
          };
        return responseMsg;
        }
        else {//Url is not matched with the trigger uri -> Stop Rule
          responseMsg = {response: "Stop foreground rule"};
          // Delete the Rule by (key)
          deleteRulesByKey(key);
          return responseMsg;
        }
      }
      if (runningRules[key].tabId == tab.id && runningRules[key].runMode == "background") {
        headRequest = runningRules[key].bg_head_only;
        //Tab Id found with Background Run Mode
        timeoutVal = parseInt(runningRules[key].loop_interval, 10);
        if (isNaN(timeoutVal) || timeoutVal === 0) { return invalidMsg; }//NaN or Zero Encountered - Return Invalid
        
        responseMsg = {
          response: "Run background rule",
          run: "background",
          rule_id: key, 
          timeout: timeoutVal, 
          loopUri: loopUriVal,
          headRequestOnly: headRequest
        };
        return responseMsg;
      }
    }
  }
  //Update Browser Badge
  updateBadge();
}
/*
 * Handle the Initialize message from Content Script
 * Call handleRunningRules(tab) to check for running rules
 * Else Check for new rules in the sender url
 *
 * @param {tab} Tab id, and Tab URL
*/
function handleInitializeMsg(tab) {
  var responseMsg = {};
  var invalidMsg = {response: "Invalid Settings"};
  var timeoutVal, uri, loopUriVal, bg_triggerUriVal, bg_triggerUriMatch, fg_loopUriVal, headRequest, reloadSound, tab_cookieStoreId, tab_domain;
  //Handle Running Rules
  responseMsg = handleRunningRules(tab);
  if (responseMsg) {return responseMsg;}
  uri = tab.url.replace(/\/$/, '').toLowerCase();
  tab_cookieStoreId = (tab.cookieStoreId === undefined) ? "" : tab.cookieStoreId;
  tab_domain = getDomainName(uri);// Get Domain name for supporting Wildcard URLs;
  // Iterate through the keys in aliveRules Object
  for (var key in aliveRules) {
    if (aliveRules.hasOwnProperty(key)) {
      if (aliveRules[key].rule_disable) { continue; }
      // Fetch Loop URL for URI matching
      loopUriVal =  (aliveRules[key].loop_uri && aliveRules[key].loop_uri !== "") ? aliveRules[key].loop_uri : aliveRules[key].trigger_uri;
      bg_triggerUriVal = aliveRules[key].trigger_uri;
      fg_loopUriVal =  aliveRules[key].fg_trigger_uri.replace(/\/$/, '').toLowerCase();
      //Match URI with the Loop URI of the Rule
      if (fg_loopUriVal !== "" && uri.length >= fg_loopUriVal.length && uri.indexOf(fg_loopUriVal) === 0) {
        // Loop Uri found in the Tab with Foreground Rule Match
        timeoutVal = parseInt(aliveRules[key].fg_interval, 10);
        if (isNaN(timeoutVal) || timeoutVal === 0) { return invalidMsg; }//NaN or Zero Encountered - Return Invalid
        timeoutVal = timeoutVal * 60; //Convert to Seconds
        reloadSound = aliveRules[key].fg_reload_sound;
        //Response Message
        responseMsg = {
          response: "Run foreground rule",
          run: "foreground",
          rule_id: (key+tab_domain+tab_cookieStoreId),
          timeout: timeoutVal,
          beepEnabled: reloadSound
        };
        // Add aliveRules(key) to RunningRules(Key)
        runningRules[key+tab_domain+tab_cookieStoreId] = JSON.parse(JSON.stringify(aliveRules[key]));
        runningRules[key+tab_domain+tab_cookieStoreId].tabId = tab.id;
        runningRules[key+tab_domain+tab_cookieStoreId].runMode = "foreground";
        runningRules[key+tab_domain+tab_cookieStoreId].run_uri = fg_loopUriVal;
        runningRules[key+tab_domain+tab_cookieStoreId].run_count = 0;
        runningRules[key+tab_domain+tab_cookieStoreId].last_run = "";
        runningRules[key+tab_domain+tab_cookieStoreId].cookieStoreId = tab_cookieStoreId;
        runningRules[key+tab_domain+tab_cookieStoreId].domain = tab_domain;
        //Update Browser Badge
        updateBadge();
        // Save variable to Session
        chrome.storage.session.set(runningRules);
        return responseMsg;
      }

      // Background Trigger URL matching
      bg_triggerUriMatch = false;
      if (bg_triggerUriVal !== "" && bg_triggerUriVal.indexOf('*') >= 0) {// Wildcard matching
        let re = new RegExp(bg_triggerUriVal.replace(/\/$/, '').replace(/\/\*$/, '*').toLowerCase().replace(REGEXP_ESCAPE, '\\$&').replace(REGEXP_WILDCARD, '\.$1'));
        bg_triggerUriMatch = re.test(uri);
        loopUriVal =  (aliveRules[key].loop_uri && aliveRules[key].loop_uri !== "") ? aliveRules[key].loop_uri : uri;
      }
      else if (bg_triggerUriVal !== "") {
        bg_triggerUriMatch = (bg_triggerUriVal.replace(/\/$/, '').toLowerCase() == uri);
      }
      if (bg_triggerUriMatch) {
        headRequest = aliveRules[key].bg_head_only;
        // Loop Uri found in the Tab with Background Rule Match -> Preference to Foreground Rule
        timeoutVal = parseInt(aliveRules[key].loop_interval, 10);
        if (isNaN(timeoutVal) || timeoutVal === 0) { return invalidMsg; }//NaN or Zero Encountered - Return Invalid
        
        responseMsg = {
          response: "Run background rule",
          run: "background",
          rule_id: (key+tab_domain+tab_cookieStoreId), 
          timeout: timeoutVal, 
          loopUri: loopUriVal,
          headRequestOnly: headRequest
        };
        // Add aliveRules(key) to RunningRules(Key)
        runningRules[key+tab_domain+tab_cookieStoreId] = JSON.parse(JSON.stringify(aliveRules[key]));
        runningRules[key+tab_domain+tab_cookieStoreId].tabId = tab.id;
        runningRules[key+tab_domain+tab_cookieStoreId].runMode = "background";
        runningRules[key+tab_domain+tab_cookieStoreId].run_uri = loopUriVal;
        runningRules[key+tab_domain+tab_cookieStoreId].run_count = 0;
        runningRules[key+tab_domain+tab_cookieStoreId].last_run = "";
        runningRules[key+tab_domain+tab_cookieStoreId].cookieStoreId = tab_cookieStoreId;
        runningRules[key+tab_domain+tab_cookieStoreId].domain = tab_domain;
        //Update Browser Badge
        updateBadge();
        // Save variable to Session
        chrome.storage.session.set(runningRules);
        return responseMsg;
      }
    }
  }
  //No Rules Found -> Send Response
  responseMsg = {response: "No Rules"};
  return responseMsg;
}
/*
 * Handle Ajax Request Success or Failure from Response URL
 *
 * @param {tab} Tab id, Ajax Status and Tab Ajax Response URL
*/
function handleAjax(tab){
  var responseMsg = {};
  var invalidMsg = {response: "Invalid Settings"};
  var timeoutVal, uri, loopUriVal, fg_loopUriVal, ajaxResponseUrl, ajaxResponseUrlMatch, headRequest;
  ajaxResponseUrl = tab.responseUrl.replace(/\/$/, '').toLowerCase();
  // Iterate through the keys in runningRules Object
  for (var key in runningRules) {
    if (runningRules.hasOwnProperty(key)) {
      loopUriVal =  (runningRules[key].loop_uri && runningRules[key].loop_uri !== "") ? runningRules[key].loop_uri : runningRules[key].trigger_uri;
      
      if (runningRules[key].tabId == tab.id && runningRules[key].runMode == "background") {
        //Tab Id found with Background Run Mode
        headRequest = runningRules[key].bg_head_only;
        timeoutVal = parseInt(runningRules[key].loop_interval, 10);
        if (isNaN(timeoutVal) || timeoutVal === 0) { return invalidMsg; }//NaN or Zero Encountered - Return Invalid
        // Background Trigger URL matching
        ajaxResponseUrlMatch = false;
        if (loopUriVal.indexOf('*') >= 0) {
          let re = new RegExp(loopUriVal.replace(/\/$/, '').replace(/\/\*$/, '*').toLowerCase().replace(REGEXP_ESCAPE, '\\$&').replace(REGEXP_WILDCARD, '\.$1'));
          ajaxResponseUrlMatch = re.test(ajaxResponseUrl);
          loopUriVal =  (runningRules[key].loop_uri && runningRules[key].loop_uri !== "") ? runningRules[key].loop_uri : ajaxResponseUrl;
        }
        else {
          ajaxResponseUrlMatch = (ajaxResponseUrl == loopUriVal.replace(/\/$/, '').toLowerCase());
        }
        //Check the Response is Valid or Not
        if (runningRules[key].loop_exit_200 === false || (tab.status === 200 && ajaxResponseUrlMatch)) {
          responseMsg = {
            response: "Run background rule",
            run: "background",
            rule_id: key,
            timeout: timeoutVal,
            loopUri: loopUriVal,
            headRequestOnly: headRequest
          };
          return responseMsg;
        }
        else {// Response Invalid => Stop the rule
          responseMsg = {response: "Stop background rule"};
          // Delete the Rule by (key)
          deleteRulesByKey(key);
          return responseMsg;
        }
      }
    }
  }
  //No Rules Found -> Send Response
  responseMsg = {response: "No Rules"};
  return responseMsg;
}
/*
 * Handle Add a Rule for Current Page request message from Content Script
 *
 * @param {tabs} tab list of the Active tab on the Active Window
*/
function handleAddRule(tabs){
  var url = tabs[0].url;
  var duplicate = false;
  var AddUrlMatch, TriggerUrlMatch;
  var rules = {};
  var aliveRuleId = "sa" + (new Date()).getTime();
  var aliveRuleName = "Rule " + (Object.keys(aliveRules).length + 1);
  var aliveSettings = {
    rule_name: aliveRuleName,
    rule_disable: false,
    trigger_uri: url,
    loop_uri: "",
    loop_interval: 5,
    loop_exit_200: true,
    bg_head_only: false,
    js_inject: "",
    js_trigger_uri: "",
    remove_cookies: false,
    fg_trigger_uri: "",
    fg_interval: "",
    fg_reload_sound: true,
    notif_bgrequest: false,
    notif_bgexit: true,
    notif_fgreload: false,
    notif_fgexit: true
  };
  if (protocolIsApplicable(url)) {
    /* Duplicate URL Checking */
    for (var key in aliveRules) {
      if (aliveRules.hasOwnProperty(key)) {
        if (aliveRules[key].rule_disable) { continue; }
        if(url.replace(/\/$/, '').toLowerCase() == aliveRules[key].trigger_uri.replace(/\/$/, '').toLowerCase()) {
          duplicate = true;
          break;
        }
        /* Duplicate URL Checking for WildCard URLs*/
        if (url.indexOf('*') >= 0) {
          let re = new RegExp(url.replace(/\/$/, '').replace(/\/\*$/, '*').toLowerCase().replace(REGEXP_ESCAPE, '\\$&').replace(REGEXP_WILDCARD, '\.$1'));
          AddUrlMatch = re.test(aliveRules[key].trigger_uri.replace(/\/$/, '').toLowerCase());
        }
        if (aliveRules[key].trigger_uri.indexOf('*') >= 0) {
          let re = new RegExp(aliveRules[key].trigger_uri.replace(/\/$/, '').replace(/\/\*$/, '*').toLowerCase().replace(REGEXP_ESCAPE, '\\$&').replace(REGEXP_WILDCARD, '\.$1'));
          TriggerUrlMatch = re.test(url.replace(/\/$/, '').toLowerCase());
        }
        if (AddUrlMatch || TriggerUrlMatch) {
          duplicate = true;
          break;
        }
      }
    }
    if (!duplicate) {
      // Save the Settings to {rules} Object with (key) as [aliveRuleId]
      rules[aliveRuleId] = aliveSettings;
      // Save the {rules} Object to chrome.storage.local
      chrome.storage.local.set(rules)
      .then(setItem, onError);
      chrome.tabs.reload();
    }
    else {
      displayNotifications({title: "Add a Rule", message: "Current URL is already used in another Rule! Please disable or delete that Rule first."});
      chrome.tabs.reload();
    }
  }
  else {
    displayNotifications({title: "Add a Rule", message: "Unable to create a Rule! The current URL is invalid."});
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
  console.log("Other Scripts => Background Script: Event: " + request.event );
  var senderTab = "alive-notification";
  if (sender.tab) { senderTab = (sender.tab.id) ? sender.tab.id : "alive-notification"; }
  var response, notificationTitle, notificationMessage;
  switch(request.event) {// switch Case for Event
// Initialize message from the Tab. Delegated to handleInitializeMsg()
    case "Initialize":
    response = handleInitializeMsg(sender.tab);
    //console.log(response);
    sendResponse(response);
    //this tells the browser that use the sendResponse argument after the listener has returned.
    return true;
    break;
// Cancel message from Pop-up script.
    case "Cancel":
    if (runningRules.hasOwnProperty(request.rule_id)) {//Key exists in RunningRules
      var sendToTabId = parseInt(runningRules[request.rule_id].tabId, 10);
      // Delete runningRules Object by key
      delete runningRules[request.rule_id];
      // Save variable to Session
      chrome.storage.session.clear()
      .then(() => { chrome.storage.session.set(runningRules); });
      // Update Browser Badge
      updateBadge();
      // If Tab id is valid, send the cancel message to tab
      if (!isNaN(sendToTabId)) {
        response = { response: "Cancel running rule", run: "cancel" };
        chrome.tabs.sendMessage(sendToTabId, response);
      }
      // Re-send the rules list for display
      sendResponse({event: "Running-rules-list", rules: runningRules});
      //this tells the browser that use the sendResponse argument after the listener has returned.
      return true;
    }
    break;
// Reload message from the Tab.
    case "Reload":
    if (runningRules.hasOwnProperty(request.rule_id)) {//Key exists in RunningRules
      runningRules[request.rule_id].run_count += 1;
      runningRules[request.rule_id].last_run = getTimeStr();
      // Save variable to Session
      chrome.storage.session.set(runningRules);
      if (runningRules[request.rule_id].notif_fgreload) {
        notificationTitle = "Page auto-reload rule: " + runningRules[request.rule_id].rule_name;
        notificationMessage = "Page is reloading to keep the session alive!";
        displayNotifications({tabId: senderTab, title: notificationTitle, message: notificationMessage});
      }
    }
    sendResponse();
    //this tells the browser that use the sendResponse argument after the listener has returned.
    return true;
    break;
// Ajax request details message from the Tab. Delegated to handleAjax()
    case "Ajax":
    response = handleAjax({id: sender.tab.id,status: request.status,responseUrl:request.responseUrl});
    //console.log(response);
    if (runningRules.hasOwnProperty(request.rule_id)) {//Key exists in RunningRules
      runningRules[request.rule_id].run_count += 1;
      runningRules[request.rule_id].last_run = getTimeStr();
      // Save variable to Session
      chrome.storage.session.set(runningRules);
      if (runningRules[request.rule_id].notif_bgrequest) {
        notificationTitle = "Background request rule: " + runningRules[request.rule_id].rule_name;
        notificationMessage = "Background Request to keep the session alive is successful!";
        displayNotifications({tabId: senderTab, title: notificationTitle, message: notificationMessage});
      }
    }
    sendResponse(response);
    //this tells the browser that use the sendResponse argument after the listener has returned.
    return true;
    break;
// Running rules request message from Pop-up script.
    case "Running-rules":
    sendResponse({event: "Running-rules-list", rules: runningRules});
    //this tells the browser that use the sendResponse argument after the listener has returned.
    return true;
    break;
// Add a Rule for Current Page request message from Pop-up script.
    case "Add-Rule-Current-Page":
      let querying = chrome.tabs.query({currentWindow: true, active: true});
      querying.then(handleAddRule, onError);
      sendResponse();
      //this tells the browser that use the sendResponse argument after the listener has returned.
      return true;
    break;

    default:
    //Default Switch - No Action";
  }
}
/*
** Add Listener to Handle the message from Content Script
*/
chrome.runtime.onMessage.addListener(handleMessage);
/*
** On Initialization, fetch stored settings and update the local variable with them.
*/
const gettingStoredSettings = chrome.storage.local.get();
gettingStoredSettings.then(updateRules, onError);
/*
** On Initialization, fetch stored session variables and update the local variable with them.
*/
const initSessionStorage = chrome.storage.session.get();
initSessionStorage.then(updateVariables, onError);
/*
** Log the Storage Change details
*/
chrome.storage.onChanged.addListener(handleStorageChange);
/*
** Open onboarding and upboarding page
*/
chrome.runtime.onInstalled.addListener(function (details) {
  switch (details.reason) {
    case "install": {
      const url = chrome.runtime.getURL("views/installed.html");
      chrome.tabs.create({ url: url, active: true});
      var notificationMessage = "Thanks for installing Session Alive extension! Create a rule to keep your Session Alive!";
      displayNotifications({title: "Session Alive Installed",message: notificationMessage});
    } break;
    case "update": {
      const url = chrome.runtime.getURL("views/updated.html");
      chrome.tabs.create({ url: url, active: true});
    } break;
    default:
    //Default Switch - No Action";
  }
});
/*
** Open feedback page for offboarding users
*/
chrome.runtime.setUninstallURL("https://docs.google.com/forms/d/e/1FAIpQLSf9gdcJycSTzriZZDWDKcW3JKd8h0dSkO8guvx1LRSAF2LzDQ/viewform?usp=sf_link");
/*
** Add Listener to handle Notification click
*/
chrome.notifications.onClicked.addListener(function(notificationId) {
  chrome.notifications.clear(notificationId);
  var tabId = parseInt(notificationId, 10);
  if (!isNaN(tabId)) { chrome.tabs.update(tabId, { active: true }); }
});
/*
 * Tab Events - Tab Remove handle
*/
function handleRemoved(tabId, removeInfo) {
  // Return if no Running Rules
  totRunningRules = Object.keys(runningRules).length;
  if (totRunningRules === 0) { return null; }
  // Iterate through the keys in runningRules Object
  for (var key in runningRules) {
    if (runningRules.hasOwnProperty(key)) {
      if (runningRules[key].tabId == tabId) {
        delete runningRules[key];
        // Save variable to Session
        chrome.storage.session.clear()
        .then(() => { chrome.storage.session.set(runningRules); });
        //Update Browser Badge
        updateBadge();
      }
    }
  }
}
/*
** Add Listener to Handle the Tab Close [onRemoved]
*/
chrome.tabs.onRemoved.addListener(handleRemoved);
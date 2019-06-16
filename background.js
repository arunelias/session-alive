"use strict";
console.clear();

var aliveRules = {};
var runningRules = {};
var totRunningRules = 0;
/*
 * Display Notifications
 *
 * @param {data} tabId for notification id, notification title, and notification message
*/
function displayNotifications(data){
    var tabId = (data.tabId) ? data.tabId.toString() : "alive-notification";
    browser.notifications.create(tabId, {
        "type": "basic",
        "title": data.title,
        "iconUrl": browser.extension.getURL("assets/icon/icon.svg"),
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
 * Update Browser Badge with the total Number of Running Rules
 *
 * @param {} nil
*/
function updateBadge() {
  totRunningRules = Object.keys(runningRules).length;//Get No. of Running Rules
  if (totRunningRules > 0) { browser.browserAction.setBadgeText({text: totRunningRules.toString()}); }
  else { browser.browserAction.setBadgeText({text: ""}); }
}
/*
 * Update Rules to the Local Variable aliveRules
 *
 * @param {aliveSettings} Session Alive Settings
*/
function updateRules(aliveSettings) {aliveRules = aliveSettings;}
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
  //Update Browser Badge
  updateBadge();
}
/*
 * Update Rules when Settings are updated
 *
 * @param {} nil
*/
function handleStorageChange() {
  var updateAliveRules = browser.storage.local.get();
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
  var timeoutVal, uri, loopUriVal, bg_triggerUriVal, fg_loopUriVal, headRequest, reloadSound, tab_cookieStoreId;
  uri = tab.url.replace(/\/$/, '').toLowerCase();
  tab_cookieStoreId = (tab.cookieStoreId === undefined) ? "" : tab.cookieStoreId;
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
        if (runningRules[key].tabId != tab.id) { responseMsg = {response: "Rule already running"}; return responseMsg;}
      }
      if (runningRules[key].runMode == "background" && bg_triggerUriVal !== "" && bg_triggerUriVal.replace(/\/$/, '').toLowerCase() == uri && runningRules[key].cookieStoreId == tab_cookieStoreId) {
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
  var timeoutVal, uri, loopUriVal, bg_triggerUriVal, fg_loopUriVal, headRequest, reloadSound, tab_cookieStoreId;
  //Handle Running Rules
  responseMsg = handleRunningRules(tab);
  if (responseMsg) {return responseMsg;}
  uri = tab.url.replace(/\/$/, '').toLowerCase();
  tab_cookieStoreId = (tab.cookieStoreId === undefined) ? "" : tab.cookieStoreId;
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
          rule_id: key,
          timeout: timeoutVal,
          beepEnabled: reloadSound
        };
        // Add aliveRules(key) to RunningRules(Key)
        runningRules[key+tab_cookieStoreId] = JSON.parse(JSON.stringify(aliveRules[key]));
        runningRules[key+tab_cookieStoreId].tabId = tab.id;
        runningRules[key+tab_cookieStoreId].runMode = "foreground";
        runningRules[key+tab_cookieStoreId].run_uri = fg_loopUriVal;
        runningRules[key+tab_cookieStoreId].run_count = 0;
        runningRules[key+tab_cookieStoreId].last_run = "";
        runningRules[key+tab_cookieStoreId].cookieStoreId = tab_cookieStoreId;
        //Update Browser Badge
        updateBadge();
        return responseMsg;
      }

      if (bg_triggerUriVal !== "" && bg_triggerUriVal.replace(/\/$/, '').toLowerCase() == uri) {
        headRequest = aliveRules[key].bg_head_only;
        // Loop Uri found in the Tab with Background Rule Match -> Preference to Foreground Rule
        timeoutVal = parseInt(aliveRules[key].loop_interval, 10);
        if (isNaN(timeoutVal) || timeoutVal === 0) { return invalidMsg; }//NaN or Zero Encountered - Return Invalid
        
        responseMsg = {
          response: "Run background rule",
          run: "background",
          rule_id: key, 
          timeout: timeoutVal, 
          loopUri: loopUriVal,
          headRequestOnly: headRequest
        };
        // Add aliveRules(key) to RunningRules(Key)
        runningRules[key+tab_cookieStoreId] = JSON.parse(JSON.stringify(aliveRules[key]));
        runningRules[key+tab_cookieStoreId].tabId = tab.id;
        runningRules[key+tab_cookieStoreId].runMode = "background";
        runningRules[key+tab_cookieStoreId].run_uri = loopUriVal;
        runningRules[key+tab_cookieStoreId].run_count = 0;
        runningRules[key+tab_cookieStoreId].last_run = "";
        runningRules[key+tab_cookieStoreId].cookieStoreId = tab_cookieStoreId;
        //Update Browser Badge
        updateBadge();
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
  var timeoutVal, uri, loopUriVal, fg_loopUriVal, ajaxResponseUrl, headRequest;
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
        //Check the Response is Valid or Not
        if (runningRules[key].loop_exit_200 === false || (tab.status === 200 && ajaxResponseUrl == loopUriVal.replace(/\/$/, '').toLowerCase())) {
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
      // Update Browser Badge
      updateBadge();
      // If Tab id is valid, send the cancel message to tab
      if (!isNaN(sendToTabId)) {
        response = { response: "Cancel running rule", run: "cancel" };
        browser.tabs.sendMessage(sendToTabId, response);
      }
      // Re-send the rules list for display
      browser.runtime.sendMessage({event: "Running-rules-list", rules: runningRules});
    }
    break;
// Reload message from the Tab.
    case "Reload":
    if (runningRules.hasOwnProperty(request.rule_id)) {//Key exists in RunningRules
      runningRules[request.rule_id].run_count += 1;
      runningRules[request.rule_id].last_run = getTimeStr();
      if (runningRules[request.rule_id].notif_fgreload) {
        notificationTitle = "Page auto-reload rule: " + runningRules[request.rule_id].rule_name;
        notificationMessage = "Page is reloading to keep the session alive!";
        displayNotifications({tabId: senderTab, title: notificationTitle, message: notificationMessage});
      }
    }
    break;
// Ajax request details message from the Tab. Delegated to handleAjax()
    case "Ajax":
    response = handleAjax({id: sender.tab.id,status: request.status,responseUrl:request.responseUrl});
    //console.log(response);
    browser.tabs.sendMessage(sender.tab.id, response);
    if (runningRules.hasOwnProperty(request.rule_id)) {//Key exists in RunningRules
      runningRules[request.rule_id].run_count += 1;
      runningRules[request.rule_id].last_run = getTimeStr();
      if (runningRules[request.rule_id].notif_bgrequest) {
        notificationTitle = "Background request rule: " + runningRules[request.rule_id].rule_name;
        notificationMessage = "Background Request to keep the session alive is successful!";
        displayNotifications({tabId: senderTab, title: notificationTitle, message: notificationMessage});
      }
    }
    break;
// Running rules request message from Pop-up script.
    case "Running-rules":
    browser.runtime.sendMessage({event: "Running-rules-list", rules: runningRules});
    break;

    default:
    //Default Switch - No Action";
  }
}
/*
** Add Listener to Handle the message from Content Script
*/
browser.runtime.onMessage.addListener(handleMessage);
/*
** On Initialization, fetch stored settings and update the local variable with them.
*/
const gettingStoredSettings = browser.storage.local.get();
gettingStoredSettings.then(updateRules, onError);
/*
** Log the Storage Change details
*/
browser.storage.onChanged.addListener(handleStorageChange);
/*
** Open onboarding and upboarding page
*/
browser.runtime.onInstalled.addListener(function (details) {
  switch (details.reason) {
    case "install": {
      const url = browser.runtime.getURL("views/installed.html");
      browser.tabs.create({ url: url, active: true});
      var notificationMessage = "Thanks for installing Session Alive extension! Create a rule to keep your Session Alive!";
      displayNotifications({title: "Session Alive Installed",message: notificationMessage});
    } break;
    case "update": {
      const url = browser.runtime.getURL("views/updated.html");
      browser.tabs.create({ url: url, active: true});
    } break;
    default:
    //Default Switch - No Action";
  }
});
/*
** Open feedback page for offboarding users
*/
browser.runtime.setUninstallURL("https://docs.google.com/forms/d/e/1FAIpQLSf9gdcJycSTzriZZDWDKcW3JKd8h0dSkO8guvx1LRSAF2LzDQ/viewform?usp=sf_link");
/*
** Add Listener to handle Notification click
*/
browser.notifications.onClicked.addListener(function(notificationId) {
  browser.notifications.clear(notificationId);
  var tabId = parseInt(notificationId, 10);
  if (!isNaN(tabId)) { browser.tabs.update(tabId, { active: true }); }
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
        //Update Browser Badge
        updateBadge();
      }
    }
  }
}
/*
** Add Listener to Handle the Tab Close [onRemoved]
*/
browser.tabs.onRemoved.addListener(handleRemoved);
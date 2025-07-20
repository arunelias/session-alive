/**
 * @fileoverview Background script for Session Alive Chrome extension.
 * Manages rules for keeping sessions alive via foreground page reloads or background requests.
 * Handles storage, notifications, and tab events.
 */
"use strict";

var aliveRules = {};
var runningRules = {};
var totRunningRules = 0;
const APPLICABLE_PROTOCOLS = ["http:", "https:"];
const REGEXP_WILDCARD = /(\*)/g;
const REGEXP_ESCAPE = /[.+\-?^${}()|[\]\\]/g;

/** @type {boolean} isInitialized - Tracks the initialization state */
let isInitialized = false;
/** @constant {Promise[]} initializationPromises - Promises for fetching storage data during initialization */
const initializationPromises = [
  chrome.storage.local.get().then(updateRules, onError),
  chrome.storage.session.get().then(updateVariables, onError)
];

/**
 * Sets initialization flag when both storage promises resolve.
 * @returns {void}
 */
Promise.all(initializationPromises).then(() => {
  isInitialized = true;
  console.log("Initialization complete: aliveRules and runningRules are ready.");
}).catch((error) => {
  console.error("Initialization failed:", error);
});

/**
 * Checks if the URL's protocol is supported.
 * @param {string} url - The URL to check.
 * @returns {boolean} True if the protocol is in APPLICABLE_PROTOCOLS.
 */
function protocolIsApplicable(url) {
  var anchor = new URL(url);
  return APPLICABLE_PROTOCOLS.includes(anchor.protocol);
}

/**
 * Extracts the domain name from a URL.
 * @param {string} url - The URL to process.
 * @returns {string} The domain name (host) of the URL.
 */
function getDomainName(url) {
  var anchor = new URL(url);
  return anchor.host;
}

/**
 * Retrieves translated notification title and message using i18n API.
 * @param {string} title - The default title to use if translation is unavailable.
 * @param {string} message - The default message to use if translation is unavailable.
 * @param {string} key - The key prefix for translation lookup (e.g., "addRuleSuccess" for "addRuleSuccessTitle" and "addRuleSuccessMessage").
 * @returns {Object} An object containing the translated or fallback title and message.
 */
function getTranslatedNotification({ title, message, key }) {
  // Retrieve translated title and message using key, falling back to provided values
  const translatedTitle = chrome.i18n.getMessage(`${key}Title`) || title;
  const translatedMessage = chrome.i18n.getMessage(`${key}Message`) || message;

  // Return an object with the translated (or fallback) title and message
  return {
    title: translatedTitle,
    message: translatedMessage
  };
}

/**
 * Displays a notification to the user.
 * @param {Object} data - Notification data.
 * @param {number} [data.tabId] - Tab ID for notification ID.
 * @param {string} data.title - Notification title.
 * @param {string} data.message - Notification message.
 * @returns {void}
 */
function displayNotifications(data) {
  var tabId = (data.tabId) ? (data.tabId.toString() + "-" + Date.now()) : "";
  chrome.notifications.create(tabId, {
    "type": "basic",
    "iconUrl": "assets/icon/icon.png",
    "title": data.title,
    "message": data.message
  });
}

/**
 * Returns the current time in string format (e.g., "01:30 PM").
 * @returns {string} Formatted time string.
 */
function getTimeStr() {
  var d = new Date();
  var hr = d.getHours();
  var min = d.getMinutes();
  if (min < 10) { min = "0" + min; }
  var ampm = "AM";
  if (hr > 12) { hr -= 12; ampm = "PM"; }
  if (hr < 10) { hr = "0" + hr; }
  return hr + ":" + min + "\u00A0" + ampm;
}

/**
 * Logs errors to the console.
 * @param {Error} e - The error object.
 * @returns {void}
 */
function onError(e) { console.error(`Error: ${e}`); }

/**
 * Displays a success notification when a Rule is added from Popup.
 * @returns {void}
 */
function setItem() {
  console.log("Store Settings Successful!");
  const { title: translatedTitle, message: translatedMessage } = getTranslatedNotification({
    title: "Add a Rule",
    message: "Rule saved successfully!",
    key: "addRuleSuccess"
  });
  displayNotifications({ title: translatedTitle, message: translatedMessage });
}

/**
 * Updates the browser action badge with the number of running rules.
 * @returns {void}
 */
function updateBadge() {
  var totRunningRules = Object.keys(runningRules).length;//Get No. of Running Rules
  if (totRunningRules > 0) { chrome.action.setBadgeText({ text: totRunningRules.toString() }); }
  else { chrome.action.setBadgeText({ text: "" }); }
}

/**
 * Updates the aliveRules object with rules from local storage.
 * @param {Object} aliveSettings - Session alive settings from chrome.storage.local.
 * @returns {void}
 */
function updateRules(aliveSettings) {
  aliveRules = aliveSettings;
  // Compile and store RegExp
  for (const key in aliveRules) {
    const rule = aliveRules[key];

    if (rule.trigger_uri.includes('*')) {
      const pattern = rule.trigger_uri.replace(/\/$/, '').toLowerCase();

      const regexPattern = pattern
        .replace(/\/\*$/, '*')
        .replace(REGEXP_ESCAPE, '\\$&')
        .replace(REGEXP_WILDCARD, '\.$1');
      rule.regexPattern = regexPattern; // Store RegExp source pattern in JSON-compatible format
      try {
        rule.compiledRegex = new RegExp(regexPattern); // Create RegExp for in-memory use
      } catch (e) {
        rule.compiledRegex = null;
      }
    } else {
      rule.regexPattern = null;
      rule.compiledRegex = null;
    }
  }
  console.log("Initialized variable aliveRules!");
}

/**
 * Updates the runningRules object with rules from session storage.
 * @param {Object} aliveSession - Running rules from chrome.storage.session.
 * @returns {void}
 */
function updateVariables(aliveSession) {
  runningRules = aliveSession;
  // Compile and store RegExp
  for (const key in runningRules) {
    const rule = runningRules[key];
    if (rule.regexPattern) {
      // Create RegExp for in-memory use
      try {
        rule.compiledRegex = new RegExp(rule.regexPattern);
      } catch (e) {
        rule.compiledRegex = null;
      }
    } else {
      rule.compiledRegex = null;
    }
  }
  console.log("Initialized variable runningRules!");
}

/**
 * Deletes a rule from runningRules by key and updates storage and badge.
 * @param {string} key - The key of the rule to delete.
 * @returns {void}
 */
function deleteRulesByKey(key) {
  // Return if no Running Rules
  totRunningRules = Object.keys(runningRules).length;
  var senderTab = runningRules[key].tabId;
  if (totRunningRules === 0) { return null; }
  // Check rule is already running in another tab or not
  if (runningRules[key].runMode == "foreground") {
    if (runningRules[key].notif_fgexit === true) {
      const { title: translatedTitle, message: translatedMessage } = getTranslatedNotification({
        title: "Page auto-reload rule: ",
        message: "Foreground page auto-reload Rule stopped!",
        key: "fgRuleStopped"
      });
      const rule_name = runningRules[key].rule_name;
      displayNotifications({ tabId: senderTab, title: `${translatedTitle}${rule_name}`, message: translatedMessage });
    }
  }
  if (runningRules[key].runMode == "background") {
    if (runningRules[key].notif_bgexit === true) {
      const { title: translatedTitle, message: translatedMessage } = getTranslatedNotification({
        title: "Background request rule: ",
        message: "Background Request Rule stopped! The server response was not 200 OK!",
        key: "bgRuleStopped"
      });
      const rule_name = runningRules[key].rule_name;
      displayNotifications({ tabId: senderTab, title: `${translatedTitle}${rule_name}`, message: translatedMessage });
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

/**
 * Updates rules when settings are updated.
 * @returns {void}
 */
function handleStorageChange() {
  var updateAliveRules = chrome.storage.local.get();
  updateAliveRules.then(updateRules, onError);
}

/**
 * Handles running rules for a given tab.
 * @param {Object} tab - Tab object containing id and url.
 * @returns {Object|null} Response message or null if no rules apply.
 */
function handleRunningRules(tab) {
  var responseMsg = {};
  var invalidMsg = { response: "Invalid Settings" };
  var timeoutVal, uri, loopUriVal, bg_triggerUriVal, bg_triggerUriMatch, fg_loopUriVal, headRequest, reloadSound, tab_cookieStoreId, tab_domain;
  uri = tab.url.replace(/\/$/, '').toLowerCase();
  tab_cookieStoreId = (tab.cookieStoreId === undefined) ? "" : tab.cookieStoreId;
  tab_domain = getDomainName(uri);// Get Domain name for supporting Wildcard URLs
  totRunningRules = Object.keys(runningRules).length;//Get No. of Running Rules
  if (totRunningRules === 0) { return null; }
  // Iterate through the keys in runningRules Object
  for (var key in runningRules) {
    if (runningRules.hasOwnProperty(key)) {
      loopUriVal = (runningRules[key].loop_uri && runningRules[key].loop_uri !== "") ? runningRules[key].loop_uri : runningRules[key].trigger_uri;
      bg_triggerUriVal = runningRules[key].trigger_uri;
      fg_loopUriVal = runningRules[key].fg_trigger_uri.replace(/\/$/, '').toLowerCase();
      // Check rule is already running in another tab or not
      if (runningRules[key].runMode == "foreground" && fg_loopUriVal !== "" && uri.length >= fg_loopUriVal.length && uri.indexOf(fg_loopUriVal) === 0 && runningRules[key].cookieStoreId == tab_cookieStoreId) {
        if (runningRules[key].tabId != tab.id && runningRules[key].domain == tab_domain) { responseMsg = { response: "Rule already running" }; return responseMsg; }
      }
      // Background Trigger URL matching
      bg_triggerUriMatch = false;
      if (runningRules[key].runMode == "background" && bg_triggerUriVal !== "" && bg_triggerUriVal.indexOf('*') >= 0) {// Wildcard present in Trigger URL
        // let re = new RegExp(bg_triggerUriVal.replace(/\/$/, '').replace(/\/\*$/, '*').toLowerCase().replace(REGEXP_ESCAPE, '\\$&').replace(REGEXP_WILDCARD, '\.$1'));
        // Wildcard matching using Compiled RegExp
        bg_triggerUriMatch = runningRules[key].compiledRegex.test(uri);
        loopUriVal = (runningRules[key].loop_uri && runningRules[key].loop_uri !== "") ? runningRules[key].loop_uri : uri;
      }
      else if (runningRules[key].runMode == "background" && bg_triggerUriVal !== "") {
        bg_triggerUriMatch = (bg_triggerUriVal.replace(/\/$/, '').toLowerCase() == uri);
      }
      if (bg_triggerUriMatch && runningRules[key].cookieStoreId == tab_cookieStoreId && runningRules[key].domain == tab_domain) {
        if (runningRules[key].tabId != tab.id) { responseMsg = { response: "Rule already running" }; return responseMsg; }
      }
      // Confirm call is from the tab which is Running the Rule
      if (runningRules[key].tabId == tab.id && runningRules[key].runMode == "foreground") {
        // Tab Id found with Foreground Run Mode
        timeoutVal = parseInt(runningRules[key].fg_interval, 10);
        if (isNaN(timeoutVal) || timeoutVal === 0) { return invalidMsg; }//NaN or Zero Encountered - Return Invalid
        timeoutVal = timeoutVal * 60; //Convert to Seconds
        reloadSound = runningRules[key].fg_reload_sound;
        // Match URI with the Loop URI of the Rule
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
        else {// URL is not matched with the trigger uri -> Stop Rule
          responseMsg = { response: "Stop foreground rule" };
          // Delete the Rule by (key)
          deleteRulesByKey(key);
          return responseMsg;
        }
      }
      if (runningRules[key].tabId == tab.id && runningRules[key].runMode == "background") {
        headRequest = runningRules[key].bg_head_only;
        // Tab Id found with Background Run Mode
        timeoutVal = parseInt(runningRules[key].loop_interval, 10);
        if (isNaN(timeoutVal) || timeoutVal === 0) { return invalidMsg; }// NaN or Zero Encountered - Return Invalid

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
  // Update Browser Badge
  updateBadge();
}

/**
 * Handles initialization messages from content scripts.
 * @param {Object} tab - Tab object containing id and url.
 * @returns {Object} Response message indicating rule execution or no rules found.
 */
function handleInitializeMsg(tab) {
  var responseMsg = {};
  var invalidMsg = { response: "Invalid Settings" };
  var timeoutVal, uri, loopUriVal, bg_triggerUriVal, bg_triggerUriMatch, fg_loopUriVal, headRequest, reloadSound, tab_cookieStoreId, tab_domain;
  // Handle Running Rules
  responseMsg = handleRunningRules(tab);
  if (responseMsg) { return responseMsg; }
  uri = tab.url.replace(/\/$/, '').toLowerCase();
  tab_cookieStoreId = (tab.cookieStoreId === undefined) ? "" : tab.cookieStoreId;
  tab_domain = getDomainName(uri);// Get Domain name for supporting Wildcard URLs;
  // Iterate through the keys in aliveRules Object
  for (var key in aliveRules) {
    if (aliveRules.hasOwnProperty(key)) {
      if (aliveRules[key].rule_disable) { continue; }
      // Fetch Loop URL for URI matching
      loopUriVal = (aliveRules[key].loop_uri && aliveRules[key].loop_uri !== "") ? aliveRules[key].loop_uri : aliveRules[key].trigger_uri;
      bg_triggerUriVal = aliveRules[key].trigger_uri;
      fg_loopUriVal = aliveRules[key].fg_trigger_uri.replace(/\/$/, '').toLowerCase();
      // Match URI with the Loop URI of the Rule
      if (fg_loopUriVal !== "" && uri.length >= fg_loopUriVal.length && uri.indexOf(fg_loopUriVal) === 0) {
        // Loop Uri found in the Tab with Foreground Rule Match
        timeoutVal = parseInt(aliveRules[key].fg_interval, 10);
        if (isNaN(timeoutVal) || timeoutVal === 0) { return invalidMsg; }//NaN or Zero Encountered - Return Invalid
        timeoutVal = timeoutVal * 60; //Convert to Seconds
        reloadSound = aliveRules[key].fg_reload_sound;
        // Response Message
        responseMsg = {
          response: "Run foreground rule",
          run: "foreground",
          rule_id: (key + tab_domain + tab_cookieStoreId),
          timeout: timeoutVal,
          beepEnabled: reloadSound
        };
        // Add aliveRules(key) to RunningRules(Key)
        runningRules[key + tab_domain + tab_cookieStoreId] = JSON.parse(JSON.stringify(aliveRules[key]));
        runningRules[key + tab_domain + tab_cookieStoreId].tabId = tab.id;
        runningRules[key + tab_domain + tab_cookieStoreId].runMode = "foreground";
        runningRules[key + tab_domain + tab_cookieStoreId].run_uri = fg_loopUriVal;
        runningRules[key + tab_domain + tab_cookieStoreId].run_count = 0;
        runningRules[key + tab_domain + tab_cookieStoreId].last_run = "";
        runningRules[key + tab_domain + tab_cookieStoreId].cookieStoreId = tab_cookieStoreId;
        runningRules[key + tab_domain + tab_cookieStoreId].domain = tab_domain;
        runningRules[key + tab_domain + tab_cookieStoreId].compiledRegex = aliveRules[key].compiledRegex; // Assign the compiled RegExp object
        // Update Browser Badge
        updateBadge();
        // Save variable to Session
        chrome.storage.session.set(runningRules);
        return responseMsg;
      }

      // Background Trigger URL matching
      bg_triggerUriMatch = false;
      if (bg_triggerUriVal !== "" && bg_triggerUriVal.indexOf('*') >= 0) {// Wildcard matching
        // let re = new RegExp(bg_triggerUriVal.replace(/\/$/, '').replace(/\/\*$/, '*').toLowerCase().replace(REGEXP_ESCAPE, '\\$&').replace(REGEXP_WILDCARD, '\.$1'));
        // Wildcard matching using Compiled RegExp
        bg_triggerUriMatch = aliveRules[key].compiledRegex.test(uri);
        loopUriVal = (aliveRules[key].loop_uri && aliveRules[key].loop_uri !== "") ? aliveRules[key].loop_uri : uri;
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
          rule_id: (key + tab_domain + tab_cookieStoreId),
          timeout: timeoutVal,
          loopUri: loopUriVal,
          headRequestOnly: headRequest
        };
        // Add aliveRules(key) to RunningRules(Key)
        runningRules[key + tab_domain + tab_cookieStoreId] = JSON.parse(JSON.stringify(aliveRules[key]));
        runningRules[key + tab_domain + tab_cookieStoreId].tabId = tab.id;
        runningRules[key + tab_domain + tab_cookieStoreId].runMode = "background";
        runningRules[key + tab_domain + tab_cookieStoreId].run_uri = loopUriVal;
        runningRules[key + tab_domain + tab_cookieStoreId].run_count = 0;
        runningRules[key + tab_domain + tab_cookieStoreId].last_run = "";
        runningRules[key + tab_domain + tab_cookieStoreId].cookieStoreId = tab_cookieStoreId;
        runningRules[key + tab_domain + tab_cookieStoreId].domain = tab_domain;
        runningRules[key + tab_domain + tab_cookieStoreId].compiledRegex = aliveRules[key].compiledRegex;
        // Update Browser Badge
        updateBadge();
        // Save variable to Session
        chrome.storage.session.set(runningRules);
        return responseMsg;
      }
    }
  }
  // No Rules Found -> Send Response
  responseMsg = { response: "No Rules" };
  return responseMsg;
}

/**
 * Handles AJAX request success or failure.
 * @param {Object} tab - Object containing tab id, AJAX status, and response URL.
 * @returns {Object} Response message indicating rule continuation or termination.
 */
function handleAjax(tab) {
  var responseMsg = {};
  var invalidMsg = { response: "Invalid Settings" };
  var timeoutVal, uri, loopUriVal, fg_loopUriVal, ajaxResponseUrl, ajaxResponseUrlMatch, headRequest;
  ajaxResponseUrl = tab.responseUrl.replace(/\/$/, '').toLowerCase();
  // Iterate through the keys in runningRules Object
  for (var key in runningRules) {
    if (runningRules.hasOwnProperty(key)) {
      loopUriVal = (runningRules[key].loop_uri && runningRules[key].loop_uri !== "") ? runningRules[key].loop_uri : runningRules[key].trigger_uri;

      if (runningRules[key].tabId == tab.id && runningRules[key].runMode == "background") {
        // Tab Id found with Background Run Mode
        headRequest = runningRules[key].bg_head_only;
        timeoutVal = parseInt(runningRules[key].loop_interval, 10);
        if (isNaN(timeoutVal) || timeoutVal === 0) { return invalidMsg; }// NaN or Zero Encountered - Return Invalid
        // Background Trigger URL matching
        ajaxResponseUrlMatch = false;
        if (loopUriVal.indexOf('*') >= 0) {
          // let re = new RegExp(loopUriVal.replace(/\/$/, '').replace(/\/\*$/, '*').toLowerCase().replace(REGEXP_ESCAPE, '\\$&').replace(REGEXP_WILDCARD, '\.$1'));
          // Wildcard matching using Compiled RegExp
          ajaxResponseUrlMatch = runningRules[key].compiledRegex.test(ajaxResponseUrl);
          loopUriVal = (runningRules[key].loop_uri && runningRules[key].loop_uri !== "") ? runningRules[key].loop_uri : ajaxResponseUrl;
        }
        else {
          ajaxResponseUrlMatch = (ajaxResponseUrl == loopUriVal.replace(/\/$/, '').toLowerCase());
        }
        // Check the Response is Valid or Not
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
          responseMsg = { response: "Stop background rule" };
          // Delete the Rule by (key)
          deleteRulesByKey(key);
          return responseMsg;
        }
      }
    }
  }
  // No Rules Found -> Send Response
  responseMsg = { response: "No Rules" };
  return responseMsg;
}

/**
 * Handles adding a rule for the current page.
 * @param {Object[]} tabs - Array of tab objects, typically the active tab.
 * @returns {void}
 */
function handleAddRule(tabs) {
  var url = tabs[0].url;
  var duplicate = false;
  var AddUrlMatch, TriggerUrlMatch;
  var rules = {};
  var aliveRuleId = "sa" + (new Date()).getTime();
  // var aliveRuleName = "Rule " + (Object.keys(aliveRules).length + 1);
  // Derive Rule Name from the Page Title
  var aliveRuleName = tabs[0].title;
  if (aliveRuleName.length > 30) {
    var trimmedString = aliveRuleName.substr(0, 30);
    // RegExp to match separators (·, –, -, |, :) surrounded by spaces
    const separatorRegex = /\s*([·–\-|:])\s*/;
    const match = trimmedString.match(separatorRegex);
    if (match && match.index + match[0].length <= 30) {
      // Trim to the start of the matched separator
      aliveRuleName = trimmedString.substring(0, match.index).trim();
    } else {
      // Fallback: Trim to last space
      aliveRuleName = trimmedString.substr(0, Math.min(trimmedString.length, trimmedString.lastIndexOf(" ")));
    }
  }
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
    // Duplicate URL Checking
    for (var key in aliveRules) {
      if (aliveRules.hasOwnProperty(key)) {
        if (aliveRules[key].rule_disable) { continue; }
        if (url.replace(/\/$/, '').toLowerCase() == aliveRules[key].trigger_uri.replace(/\/$/, '').toLowerCase()) {
          duplicate = true;
          break;
        }
        // Duplicate URL Checking for WildCard URLs
        if (url.indexOf('*') >= 0) {
          // let re = new RegExp(url.replace(/\/$/, '').replace(/\/\*$/, '*').toLowerCase().replace(REGEXP_ESCAPE, '\\$&').replace(REGEXP_WILDCARD, '\.$1'));
          // Wildcard matching using Compiled RegExp
          AddUrlMatch = aliveRules[key].compiledRegex.test(aliveRules[key].trigger_uri.replace(/\/$/, '').toLowerCase());
        }
        if (aliveRules[key].trigger_uri.indexOf('*') >= 0) {
          // let re = new RegExp(aliveRules[key].trigger_uri.replace(/\/$/, '').replace(/\/\*$/, '*').toLowerCase().replace(REGEXP_ESCAPE, '\\$&').replace(REGEXP_WILDCARD, '\.$1'));
          // Wildcard matching using Compiled RegExp
          TriggerUrlMatch = aliveRules[key].compiledRegex.test(url.replace(/\/$/, '').toLowerCase());
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
      const { title: translatedTitle, message: translatedMessage } = getTranslatedNotification({
        title: "Add a Rule",
        message: "Current URL is already used in another Rule! Please disable or delete that Rule first.",
        key: "addRuleDupError"
      });
      displayNotifications({ title: translatedTitle, message: translatedMessage });
      chrome.tabs.reload();
    }
  }
  else {
    const { title: translatedTitle, message: translatedMessage } = getTranslatedNotification({
      title: "Add a Rule",
      message: "Unable to create a Rule! The current URL is invalid.",
      key: "addRuleInvError"
    });
    displayNotifications({ title: translatedTitle, message: translatedMessage });
  }
}

/**
 * Handles messages from content or popup scripts.
 * @param {Object} request - The request object containing the event and data.
 * @param {Object} sender - The sender object containing tab information.
 * @param {Function} sendResponse - Callback to send response to the sender.
 * @returns {boolean} True to keep the message channel open for async response.
 */
function handleMessage(request, sender, sendResponse) {
  console.log("Other Scripts => Background Script: Event: " + request.event);

  // Ensure initialization is complete before processing messages
  if (!isInitialized) {
    Promise.all(initializationPromises).then(() => {
      handleMessageAfterInit(request, sender, sendResponse);
    }).catch((error) => {
      console.error("Initialization error during message handling:", error);
      sendResponse({ response: "Initialization error" });
    });
    return true; // Keep the message channel open for async response
  } else {
    handleMessageAfterInit(request, sender, sendResponse);
    return true;
  }
}

/**
 * Processes messages after initialization is complete.
 * @param {Object} request - The request object containing the event and data.
 * @param {Object} sender - The sender object containing tab information.
 * @param {Function} sendResponse - Callback to send response to the sender.
 * @returns {boolean} True to keep the message channel open for async response.
 */
function handleMessageAfterInit(request, sender, sendResponse) {
  var senderTab = sender.tab ? sender.tab.id : "alive-notification";
  var response;
  switch (request.event) {// switch Case for Event
    // Initialize message from the Tab. Delegated to handleInitializeMsg()
    case "Initialize":
      response = handleInitializeMsg(sender.tab);
      // console.log(response);
      sendResponse(response);
      // this tells the browser that use the sendResponse argument after the listener has returned.
      return true;
      break;
    // Cancel message from Pop-up script.
    case "Cancel":
      if (runningRules.hasOwnProperty(request.rule_id)) {// Key exists in RunningRules
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
        sendResponse({ event: "Running-rules-list", rules: runningRules });
        // this tells the browser that use the sendResponse argument after the listener has returned.
        return true;
      }
      break;
    // Reload message from the Tab.
    case "Reload":
      if (runningRules.hasOwnProperty(request.rule_id)) {// Key exists in RunningRules
        runningRules[request.rule_id].run_count += 1;
        runningRules[request.rule_id].last_run = getTimeStr();
        // Save variable to Session
        chrome.storage.session.set(runningRules);
        if (runningRules[request.rule_id].notif_fgreload) {
          const { title: translatedTitle, message: translatedMessage } = getTranslatedNotification({
            title: "Page auto-reload rule: ",
            message: "Page is reloading to keep the session alive!",
            key: "fgRuleSuccess"
          });
          const rule_name = runningRules[request.rule_id].rule_name;
          displayNotifications({ tabId: senderTab, title: `${translatedTitle}${rule_name}`, message: translatedMessage });
        }
      }
      sendResponse();
      // this tells the browser that use the sendResponse argument after the listener has returned.
      return true;
      break;
    // Ajax request details message from the Tab. Delegated to handleAjax()
    case "Ajax":
      response = handleAjax({ id: sender.tab.id, status: request.status, responseUrl: request.responseUrl });
      //console.log(response);
      if (runningRules.hasOwnProperty(request.rule_id)) {//Key exists in RunningRules
        runningRules[request.rule_id].run_count += 1;
        runningRules[request.rule_id].last_run = getTimeStr();
        // Save variable to Session
        chrome.storage.session.set(runningRules);
        if (runningRules[request.rule_id].notif_bgrequest) {
          const { title: translatedTitle, message: translatedMessage } = getTranslatedNotification({
            title: "Background request rule: ",
            message: "Background Request to keep the session alive is successful!",
            key: "bgRuleSuccess"
          });
          const rule_name = runningRules[request.rule_id].rule_name;
          displayNotifications({ tabId: senderTab, title: `${translatedTitle}${rule_name}`, message: translatedMessage });
        }
      }
      sendResponse(response);
      // this tells the browser that use the sendResponse argument after the listener has returned.
      return true;
      break;
    // Ping request message from Pop-up script.
    case "ping":
      Promise.all(initializationPromises).then(sendResponse({ status: "ready" }));
      // this tells the browser that use the sendResponse argument after the listener has returned.
      return true;
      break;
    // Running rules request message from Pop-up script.
    case "Running-rules":
      Promise.all(initializationPromises).then(sendResponse({ event: "Running-rules-list", rules: runningRules }));
      // this tells the browser that use the sendResponse argument after the listener has returned.
      return true;
      break;
    // Add a Rule for Current Page request message from Pop-up script.
    case "Add-Rule-Current-Page":
      let querying = chrome.tabs.query({ currentWindow: true, active: true });
      querying.then(handleAddRule, onError);
      sendResponse();
      // this tells the browser that use the sendResponse argument after the listener has returned.
      return true;
      break;

    default:
    //Default Switch - No Action";
  }
}

/**
 * Adds a listener for chrome.runtime.onMessage to handle messages from content or popup scripts.
 * @param {Object} request - The request object.
 * @param {Object} sender - The sender object.
 * @param {Function} sendResponse - Callback to send response.
 * @returns {void}
 */
chrome.runtime.onMessage.addListener(handleMessage);

/**
 * Listens for storage changes and updates rules accordingly.
 * @param {Object} changes - The changes in storage.
 * @param {string} areaName - The storage area ('local' or 'session').
 * @returns {void}
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  // Listen for storage.local changes only
  if (areaName !== 'local') return;
  handleStorageChange(changes);
});

/**
 * Handles extension installation or update events.
 * @param {Object} details - Installation details.
 * @returns {void}
 */
chrome.runtime.onInstalled.addListener(function (details) {
  switch (details.reason) {
    case "install": {
      const url = chrome.runtime.getURL("views/installed.html");
      chrome.tabs.create({ url: url, active: true });
      const { title: translatedTitle, message: translatedMessage } = getTranslatedNotification({
        title: "Session Alive Installed",
        message: "Thanks for installing Session Alive extension! Create a rule to keep your Session Alive!",
        key: "aliveInstalled"
      });
      displayNotifications({ title: translatedTitle, message: translatedMessage });
    } break;
    case "update": {
      const url = chrome.runtime.getURL("views/updated.html");
      chrome.tabs.create({ url: url, active: true });
    } break;
    default:
    //Default Switch - No Action";
  }
});

// Open feedback page for offboarding users
// chrome.runtime.setUninstallURL("https://docs.google.com/forms/d/e/1FAIpQLSf9gdcJycSTzriZZDWDKcW3JKd8h0dSkO8guvx1LRSAF2LzDQ/viewform?usp=sf_link");

/**
 * Handles notification clicks by focusing the relevant tab.
 * @param {string} notificationId - The ID of the clicked notification.
 * @returns {void}
 */
chrome.notifications.onClicked.addListener(function (notificationId) {
  chrome.notifications.clear(notificationId);
  var tabId = parseInt(notificationId, 10);
  if (!isNaN(tabId)) { chrome.tabs.update(tabId, { active: true }); }
});

/**
 * Handles tab removal events by cleaning up associated rules.
 * @param {number} tabId - The ID of the removed tab.
 * @param {Object} removeInfo - Information about the removal.
 * @returns {void}
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
        // Update Browser Badge
        updateBadge();
      }
    }
  }
}

/**
 * Adds a listener for tab closed events.
 * @param {number} tabId - The ID of the closed tab.
 * @param {Object} removeInfo - Information about the closure.
 * @returns {void}
 */
chrome.tabs.onRemoved.addListener(handleRemoved);
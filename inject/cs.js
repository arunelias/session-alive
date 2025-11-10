/**
 * @fileoverview Content script for Session Alive extension.
 * This script is responsible for maintaining session activity in a web page.
 */
var aliveDiv;
var aliveDivInfo;
var idTimer;

/**
 * Starts a countdown timer for page reload to keep the session alive.
 * Displays the timer when less than 30 seconds remains.
 * Reloads the page when the countdown reaches zero.
 *
 * @param {Object} rule - Rule Details.
 * @param {string} rule.rule_id - Rule ID of the rule.
 * @param {number} rule.timeout - Timeout duration in seconds.
 * @param {boolean} rule.beepEnabled - Whether to play a beep sound before reload.
 */
startCountdown = function updateCounter(rule) {
	var id = rule.rule_id;
	var timeout = parseInt(rule.timeout, 10);//Timeout in Seconds
	var seconds = (timeout || timeout === 0) ? timeout : 30;
	var reloadBeep = rule.beepEnabled;
	if (seconds >= 0) {
		if (seconds < 30) {
			aliveDiv.style.display = "block";
			aliveDivInfo.style.display = "";
		}
		if (aliveDiv.style.display !== "none") {
			var counter = document.getElementById("session_alive_extn_countdown");
			if (counter) {
				if (seconds < 10) {
					aliveDiv.style.backgroundColor = "#ac0800";
					aliveDiv.style.color = "#ffffff";
					if (reloadBeep && seconds === 9) {
						document.getElementById("sound_element").play();
					}
				}
				else if (seconds < 30) {
					aliveDiv.style.backgroundColor = "#b1b1b3";
					aliveDiv.style.color = "#000000";
				}
				counter.innerText = seconds;
			}
		}
		// Set updateCounter() timeout to seconds-30 seconds first and 1 second onwards
		if (seconds > 30) {
			idTimer = setTimeout(function () {
				updateCounter({ rule_id: id, timeout: 30, beepEnabled: reloadBeep });
			}, (seconds - 30) * 1000);
		} else {
			idTimer = setTimeout(function () {
				updateCounter({ rule_id: id, timeout: seconds, beepEnabled: reloadBeep });
			}, 1000);
		}
		seconds -= 1;
	} else {
		if (aliveDiv.style.display !== "none") {
			//Reload Page and Message background script
			browser.runtime.sendMessage({ event: "Reload", rule_id: id }, function (resp) {
				window.onbeforeunload = null;//To Cancel any function call  which prevents leaving the page without first saving the data
				window.location.reload(true);
			});
			aliveDiv.style.display = "none";
			aliveDivInfo.style.display = "none";
		}
	}
};

/**
 * Schedules a background rule to send an AJAX request to keep the session alive.
 * Dispatches a mousemove event to simulate user activity.
 *
 * @param {Object} rule - Rule Details.
 * @param {string} rule.rule_id - Rule ID of the rule.
 * @param {number} rule.timeout - Timeout duration in seconds.
 * @param {string} rule.loopUri - URL to send the AJAX request to.
 * @param {boolean} rule.headRequestOnly - Whether to send a HEAD request instead of GET.
 */
var scheduleRule = function (rule) {
	var id = rule.rule_id;
	var timeout = parseInt(rule.timeout, 10);// Timeout in Seconds
	var uri = rule.loopUri;

	if (typeof idTimer !== "undefined") { clearTimeout(idTimer);/* Clear any Running Timer to prevent overlapping*/ }
	idTimer = setTimeout(function () {
		var xhr = new XMLHttpRequest();
		//If HEAD Request Only
		if (rule.headRequestOnly === true) { xhr.open("HEAD", uri, true); }
		else { xhr.open("GET", uri, true); }
		xhr.setRequestHeader("Cache-Control", "no-cache");
		xhr.onreadystatechange = function () { if (xhr.readyState === XMLHttpRequest.DONE) { console.log("Ajax message send"); var sending = browser.runtime.sendMessage({ event: "Ajax", rule_id: id, status: xhr.status, responseUrl: xhr.responseURL }); sending.then(handleResponse, handleError); } };
		xhr.send();
		// Dispatch bubbling keyboard events to show activity in the page
		const keydown = new KeyboardEvent('keydown', { bubbles: true });
		const keyup = new KeyboardEvent('keyup', { bubbles: true });

		[window, document, document.body].forEach(target => {
			target.dispatchEvent(keydown);
			target.dispatchEvent(keyup);
		});
	}, (timeout * 60000));
};

/**
 * Initializes the session timer and info elements in the page DOM.
 * Sets up the countdown display, tooltip, and audio element for the beep sound.
 * Adds a click event listener to snooze the timer.
 */
function initAliveElements() {
	var aliveElement, soundFile, title, content;
	aliveDiv = document.createElement("div");
	aliveDiv.id = "session_alive_extn_timer";
	// Apply localized/translated strings
	try { title = browser.i18n.getMessage("aliveDivTitle"); }
	catch (e) { title = "Scheduled Page Reload to keep the Session Alive!"; }
	aliveDiv.title = title;
	aliveDiv.style.display = "none";
	aliveElement = document.createElement("span");
	aliveElement.id = "session_alive_extn_countdown";
	aliveDiv.appendChild(aliveElement);
	aliveElement = document.createElement("span");
	aliveElement.textContent = " s";
	aliveDiv.appendChild(aliveElement);
	//Event Listner for click on div
	aliveDiv.addEventListener("click", function () {//Snooze for 1 minute
		aliveDiv.style.display = "none";
		aliveDivInfo.style.display = "none";
		clearTimeout(idTimer);
		startCountdown({ timeout: 60 });
	});
	document.body.appendChild(aliveDiv);
	//Snooze info mouse hover display Element
	aliveDivInfo = document.createElement("div");
	aliveDivInfo.id = "session_alive_extn_info";
	aliveDivInfo.style.display = "none";
	// Apply localized/translated strings
	try { content = browser.i18n.getMessage("aliveDivContent"); }
	catch (e) { content = "Click to snooze page reload for 1 minute"; }
	aliveDivInfo.textContent = content;
	document.body.appendChild(aliveDivInfo);
	//Sound Element for beep defore reload
	soundFile = browser.runtime.getURL("beep.wav");
	aliveElement = document.createElement("audio");
	aliveElement.id = "sound_element";
	aliveElement.setAttribute("src", soundFile);
	document.body.appendChild(aliveElement);
}

/**
 * Handles messages received from the background script.
 * Processes foreground countdown, background AJAX rules, or cancellation requests.
 *
 * @param {Object} message - The message object from the background script.
 * @param {string} message.run - The type of action ("foreground", "background", or "cancel").
 * @param {string} [message.rule_id] - Rule ID of the rule.
 * @param {number} [message.timeout] - Timeout duration in seconds.
 * @param {boolean} [message.beepEnabled] - Whether to play a beep sound (foreground only).
 * @param {string} [message.loopUri] - URL for AJAX request (background only).
 * @param {boolean} [message.headRequestOnly] - Whether to use HEAD request (background only).
 * @param {string} [message.response] - Response message from the background script.
 */
function handleResponse(message) {
	console.log("Background Script => Content Script: " + message.response); console.log(message);
	var intTimeout;
	if (message.run == "foreground") {
		//aliveDiv.style.display = "block";
		initAliveElements();
		intTimeout = parseInt(message.timeout, 10);// Timeout in Seconds
		if (typeof idTimer !== "undefined") { clearTimeout(idTimer);/* Clear any Running Timer to prevent overlapping*/ }
		startCountdown({ rule_id: message.rule_id, timeout: intTimeout, beepEnabled: message.beepEnabled });
	}
	if (message.run == "background") {
		intTimeout = parseInt(message.timeout, 10);
		if (typeof idTimer !== "undefined") { clearTimeout(idTimer);/* Clear any Running Timer to prevent overlapping*/ }
		scheduleRule({ rule_id: message.rule_id, timeout: intTimeout, loopUri: message.loopUri, headRequestOnly: message.headRequestOnly });
	}
	if (message.run == "cancel") {
		//Cancel Running Rule
		if (aliveDiv && aliveDivInfo) { // Check if elements are defined
			aliveDiv.style.display = "none";
			aliveDivInfo.style.display = "none";
		}
		if (typeof idTimer !== "undefined") { clearTimeout(idTimer); }
	}
}

/**
 * Handles errors from message passing with the background script.
 *
 * @param {Error} error - The error object.
 */
function handleError(error) { console.error("Error: " + error); }

/**
 * Initializes the content script by sending an "Initialize" message to the background script.
 * Sets up message listeners for background script communication.
 */
function init() {
	console.log("Initializing content script");
	var sending = browser.runtime.sendMessage({ event: "Initialize" });
	sending.then(handleResponse, handleError);
}

/**
 * Sets up a message listener for communication with the background script.
 * @listens browser.runtime.onMessage
 */
browser.runtime.onMessage.addListener(handleResponse);

//Call Initialize
init();
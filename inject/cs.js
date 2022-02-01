/*
** Content Script - Session Alive
*/
var aliveDiv;
var aliveDivInfo;
var idTimer;
/*
 * Count-down function [Foreground]
 * aliveDiv displayed from 30 sec onwards
 *
 * @param {rule} => {rule_id, timeout, beepEnabled}
*/
startCountdown = function updateCounter(rule) {
	var id = rule.rule_id;
	var timeout = parseInt(rule.timeout, 10);//Timeout in Seconds
	var seconds = (timeout || timeout === 0) ? timeout : 30;
	var reloadBeep = rule.beepEnabled;
	if (seconds >= 0) {
		if(seconds < 30) {aliveDiv.style.display = "block"; aliveDivInfo.style.display = "";}
		if (aliveDiv.style.display !== "none") {
			var counter = document.getElementById("session_alive_extn_countdown");
			if (counter) {
				if (seconds < 10) {
					aliveDiv.style.backgroundColor = "#ac0800";
					aliveDiv.style.color = "#ffffff";
					if (reloadBeep && (seconds === 9)) {document.getElementById("sound_element").play();}
				}
				else if(seconds < 30) {aliveDiv.style.backgroundColor = "#b1b1b3"; aliveDiv.style.color = "#000000";}
				counter.innerText = seconds;
			}
		}
		// Set updateCounter() timeout to seconds-30 seconds first and 1 second onwards
		if (seconds > 30) { idTimer = setTimeout(function () { updateCounter({rule_id: id, timeout: 30, beepEnabled:reloadBeep}); }, ((seconds - 30)*1000) ); }
		else { idTimer = setTimeout(function () { updateCounter({rule_id: id, timeout: seconds, beepEnabled:reloadBeep}); }, 1000); }
		seconds -= 1;
	} else {
		if (aliveDiv.style.display !== "none") {
			//Reload Page and Message background script
			browser.runtime.sendMessage({event: "Reload", rule_id: id}, function (resp) {
				window.onbeforeunload = null;//To Cancel any function call  which prevents leaving the page without first saving the data
				window.location.reload(true);
			});
			aliveDiv.style.display = "none";
			aliveDivInfo.style.display = "none";
		}
	}
};
/*
 * Scheduled Rule Run function [Background]
 *
 * @param {rule} => {rule_id, timeout, loopUri, headRequestOnly}
*/
var scheduleRule = function (rule) {
	var id = rule.rule_id;
	var timeout = parseInt(rule.timeout, 10);// Timeout in Minutes
	var uri = rule.loopUri;
	
	if (typeof idTimer !== "undefined") { clearTimeout(idTimer);/* Clear any Running Timer to prevent overlapping*/ }
	idTimer = setTimeout(function () {
		var xhr = new XMLHttpRequest();
		//If HEAD Request Only
		if (rule.headRequestOnly === true) { xhr.open("HEAD", uri, true); }
		else { xhr.open("GET", uri, true); }
		xhr.setRequestHeader("Cache-Control", "no-cache");
		xhr.onreadystatechange = function() { if(xhr.readyState === XMLHttpRequest.DONE) { browser.runtime.sendMessage({event: "Ajax", rule_id: id, status: xhr.status, responseUrl: xhr.responseURL}); } };
		xhr.send();
	}, (timeout * 60000));
};

/*
** Initialize Session Alive Elements in page
*/
function initAliveElements() {
	var aliveElement, soundFile, title, content;
	aliveDiv = document.createElement("div");
	aliveDiv.id = "session_alive_extn_timer";
	// Apply localized/translated strings
	try { title = browser.i18n.getMessage("aliveDivTitle"); }
	catch(e) { title = "Scheduled Page Reload to keep the Session Alive!"; }
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
		startCountdown({timeout: 60});
	});
	document.body.appendChild(aliveDiv);
	//Snooze info mouse hover display Element
	aliveDivInfo = document.createElement("div");
	aliveDivInfo.id = "session_alive_extn_info";
	aliveDivInfo.style.display = "none";
	// Apply localized/translated strings
	try { content = browser.i18n.getMessage("aliveDivContent"); }
	catch(e) { content = "Click to snooze page reload for 1 minute"; }
	aliveDivInfo.textContent = content;
	document.body.appendChild(aliveDivInfo);
	//Sound Element for beep defore reload
	soundFile = browser.runtime.getURL("beep.wav");
	aliveElement = document.createElement("audio");
	aliveElement.id = "sound_element";
	aliveElement.setAttribute("src", soundFile);
	document.body.appendChild(aliveElement);
}

/*
** Handle Response from Background Script
*/
function handleResponse(message) {
  console.log("Background Script => Content Script: " + message.response);console.log(message);
  var intTimeout;
  if (message.run=="foreground") {
  	//aliveDiv.style.display = "block";
  	initAliveElements();
  	intTimeout = parseInt(message.timeout, 10);
  	if (typeof idTimer !== "undefined") { clearTimeout(idTimer);/* Clear any Running Timer to prevent overlapping*/ }
  	startCountdown({rule_id:message.rule_id, timeout:intTimeout, beepEnabled:message.beepEnabled});
  }
  if (message.run=="background") {
  	intTimeout = parseInt(message.timeout, 10);
  	if (typeof idTimer !== "undefined") { clearTimeout(idTimer);/* Clear any Running Timer to prevent overlapping*/ }
  	scheduleRule({rule_id:message.rule_id, timeout:intTimeout, loopUri:message.loopUri, headRequestOnly:message.headRequestOnly});
  }
  if (message.run=="cancel") {
  	//Cancel Running Rule
  	aliveDiv.style.display = "none";
  	aliveDivInfo.style.display = "none";
  	if (typeof idTimer !== "undefined") { clearTimeout(idTimer); }
  }
}
// Handle Response Error
function handleError(error) {console.error("Error: " + error);}

/*
** Content Script initialize
*/
function init(){
	console.log("Initializing content script");
	var sending = browser.runtime.sendMessage({event: "Initialize"});
	sending.then(handleResponse, handleError);
}
/*
** Add Listener to Handle the message from Background Script
*/
browser.runtime.onMessage.addListener(handleResponse);
//Call Initialize
init();
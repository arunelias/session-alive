var aliveRules = {};
/*
** Get Elements in Page
*/
const ruleIdInput = document.getElementById("rule_id");
const ruleNameInput = document.getElementById("rule_name");
const ruleDisableInput = document.getElementById("disable_rule");
const triggerUriInput = document.getElementById("trigger_uri");
const loopUriInput = document.getElementById("loop_uri");
const loopIntervalInput = document.getElementById("loop_interval");
const loopExit200Input = document.getElementById("loop_exit_200");
const bgHeadOnlyInput = document.getElementById("bg_head_only");

const jsInjectInput = document.getElementById("js_inject");
const jsTriggerUriInput = document.getElementById("js_trigger_uri");
const removeCookiesInput = document.getElementById("remove_cookies");

const fgTriggerUriInput = document.getElementById("fg_trigger_uri");
const fgIntervalInput = document.getElementById("fg_interval");
const fgReloadSoundInput = document.getElementById("fg_reload_sound");

const notifBgrequestInput = document.getElementById("notif_bgrequest");
const notifBgexitInput = document.getElementById("notif_bgexit");
const notifFgreloadInput = document.getElementById("notif_fgreload");
const notifFgexitInput = document.getElementById("notif_fgexit");

const triggerUriLink = document.getElementById("trigger_uri_link");
const triggerUriFb = document.getElementById("trigger_uri_fb");
// Generic Error logger
function onError(e) { console.error("Error: " + e); }
/*
** Store or Update of the Rule Successful - and Refresh the UI
*/
function setItem() {
  console.log("Store Settings Successful!");
  //Update UI
  var refreshSettings = browser.storage.local.get();
  refreshSettings.then(updateUI, onError).then(function() {
    document.getElementById("rule-editor").style.display = "none";
    document.getElementById("save-success").style.display = "block";
  });
}
/*
** Deletion of the Rule Successful - and Refresh the UI
*/
function removedItem() {
  console.log("Delete Settings Successful!");
  //Update UI
  var refreshSettings = browser.storage.local.get();
  refreshSettings.then(updateUI, onError).then(function() {
    document.getElementById("rule-editor").style.display = "none";
    document.getElementById("delete-success").style.display = "block";
  });
}
/*
** Add New Rule
*/
function addNewRule() {
  document.getElementById("rule-editor").style.display = "block";
  document.getElementById("delete_rule").style.display = "none";
  document.getElementById("rule-editor-header").textContent = "Add New Rule";
  document.getElementById("save-success").style.display = "none";
  document.getElementById("delete-success").style.display = "none";
  document.getElementById("rule-info").style.display = "none";
  document.getElementById("rule-editor-form").reset();
  document.getElementById("rule-editor-form").classList.remove("was-validated");
  ruleIdInput.value = "sa" + (new Date()).getTime();
  loopExit200Input.checked = true;
  fgReloadSoundInput.checked = true;
  notifBgexitInput.checked = true;
  notifFgexitInput.checked = true;
  triggerUriInput.setAttribute("required","required");
  loopIntervalInput.setAttribute("required","required");
  fgIntervalInput.removeAttribute("required");
}
/*
** Store the currently selected settings
*/
function storeSettings() {
  var rules = {};
  var aliveRuleId = ruleIdInput.value;
  var parsed, loop_interval_value, fg_interval_value, aliveSettings;

  parsed = parseInt(loopIntervalInput.value, 10);
  loop_interval_value = (isNaN(parsed) || parsed === 0) ? "" : parsed;

  parsed = parseInt(fgIntervalInput.value, 10);
  fg_interval_value = (isNaN(parsed) || parsed === 0) ? "" : parsed;

  if (ruleDisableInput.checked) {
    document.getElementById("save-success-next-step").style.display = "none";
  } else {
    document.getElementById("save-success-next-step").style.display = "block";
    triggerUriLink.href = (fgTriggerUriInput.value && fgTriggerUriInput.value !== "") ? fgTriggerUriInput.value : triggerUriInput.value;
  }
  // Keep the URL as in format given as URL can contain base64 encoded strings
  aliveSettings = {
    rule_name: ruleNameInput.value,
    rule_disable: ruleDisableInput.checked,
    trigger_uri: triggerUriInput.value,
    loop_uri: loopUriInput.value,
    loop_interval: loop_interval_value,
    loop_exit_200: loopExit200Input.checked,
    bg_head_only: bgHeadOnlyInput.checked,
    js_inject: jsInjectInput.value,
    js_trigger_uri: jsTriggerUriInput.value,
    remove_cookies: removeCookiesInput.value,
    fg_trigger_uri: fgTriggerUriInput.value,
    fg_interval: fg_interval_value,
    fg_reload_sound: fgReloadSoundInput.checked,
    notif_bgrequest: notifBgrequestInput.checked,
    notif_bgexit: notifBgexitInput.checked,
    notif_fgreload: notifFgreloadInput.checked,
    notif_fgexit: notifFgexitInput.checked
  };
  // Save the Settings to {rules} Object with (key) as [aliveRuleId]
  rules[aliveRuleId] = aliveSettings;
  // Save the {rules} Object to browser.storage.local
  browser.storage.local.set(rules)
  .then(setItem, onError);
}
/*
 * Update editor with the settings selected
 *
 * @param {aliveSettings} aliveSettings Object contains settings of selected rule
*/
function updateEditor(aliveSettings) {
  // Display the rule editor and hide others
  document.getElementById("rule-editor").style.display = "block";
  document.getElementById("delete_rule").style.display = "inline-block";
	document.getElementById("rule-editor-header").textContent = "Edit Rule";
  document.getElementById("save-success").style.display = "none";
  document.getElementById("delete-success").style.display = "none";
  document.getElementById("rule-info").style.display = "none";
  document.getElementById("rule-editor-form").classList.remove("was-validated");
  // Iterate through the keys in {aliveSettings} Object
	for (var key in aliveSettings) {
		if (aliveSettings.hasOwnProperty(key)) {
			//console.log(key + " -> " + aliveSettings[key]);
			ruleNameInput.value = aliveSettings[key].rule_name;
      ruleDisableInput.checked = aliveSettings[key].rule_disable;
      triggerUriInput.value = aliveSettings[key].trigger_uri;
      loopUriInput.value = aliveSettings[key].loop_uri;
      loopIntervalInput.value = aliveSettings[key].loop_interval;
      loopExit200Input.checked = aliveSettings[key].loop_exit_200;
      bgHeadOnlyInput.checked = aliveSettings[key].bg_head_only;

      jsInjectInput.value = aliveSettings[key].js_inject;
      jsTriggerUriInput.value = aliveSettings[key].js_trigger_uri;
      removeCookiesInput.value = aliveSettings[key].remove_cookies;

      fgTriggerUriInput.value = aliveSettings[key].fg_trigger_uri;
      fgIntervalInput.value = aliveSettings[key].fg_interval;
      fgReloadSoundInput.checked = aliveSettings[key].fg_reload_sound;

      notifBgrequestInput.checked = aliveSettings[key].notif_bgrequest;
      notifBgexitInput.checked = aliveSettings[key].notif_bgexit;
      notifFgreloadInput.checked = aliveSettings[key].notif_fgreload;
      notifFgexitInput.checked = aliveSettings[key].notif_fgexit;
		}
	}
  // Set loop interval as required if trigger URL existing
  if(triggerUriInput.value !== "") { loopIntervalInput.setAttribute("required","required"); }
  else { loopIntervalInput.removeAttribute("required"); }
  // Set auto reload loop interval as required if foreground trigger URL existing
  if(fgTriggerUriInput.value !== "") {
    fgIntervalInput.setAttribute("required","required");
    triggerUriInput.removeAttribute("required");
    loopIntervalInput.removeAttribute("required");
  }
  else {
    fgIntervalInput.removeAttribute("required");
    triggerUriInput.setAttribute("required","required");
    loopIntervalInput.setAttribute("required","required");
  }
}
/*
 * Update Settings Page with rules saved
 *
 * @param {aliveSettings} aliveSettings Object contains settings of selected rule
*/
function updateUI(aliveSettings) {
  aliveRules = aliveSettings;
	var ruleListingNode = document.getElementById("rule-listing");
	// Clear the listing by removing nodes
  while (ruleListingNode.lastChild) {
		ruleListingNode.removeChild(ruleListingNode.lastChild);
	}
  var totRules = Object.keys(aliveSettings).length;//Get No. of Rules
  //If No Rules display the editor
  if (totRules === 0) {
    window.location.hash = '#';
    addNewRule();
    return null;
  }
	// Iterate through the keys in {aliveSettings} Object
	for (var key in aliveSettings) {
    if (aliveSettings.hasOwnProperty(key)) {
      console.log("Settings id: " + key + " -> ");
      console.log(aliveSettings[key]);
      var aliveRule = document.createElement("li");
      var aliveRuleLink = document.createElement("a");
      aliveRuleLink.href = "#";
      aliveRuleLink.textContent = aliveSettings[key].rule_name;
      aliveRule.appendChild(aliveRuleLink);
      aliveRule.id = key;
      aliveRule.dataset.id = key;
      // Add Event Listener to click event of the Rule listing
      aliveRule.addEventListener("click", function () { getSettingsByKey(this.dataset.id); });
      ruleListingNode.appendChild(aliveRule);
    }
  }
}
/*
** Delete the settings after confirming
*/
function deleteSettings() {
	var aliveRuleId = ruleIdInput.value;
	if (confirm("Are you sure you want to delete this rule?")) {
		browser.storage.local.remove(aliveRuleId)
		.then(removedItem, onError);
	}
}
/*
 * Retrieve the settings by the Key -> Rule Id
 *
 * @param {rule_id} rule id as (key) of the settings storage
*/
function getSettingsByKey(rule_id) {
	const gettingSettingsByKey = browser.storage.local.get(rule_id);
	gettingSettingsByKey.then(updateEditor, onError);
  //Reset the Rule Editor form
  document.getElementById("rule-editor-form").reset();
	//Set the Rule Id in the Editor
  ruleIdInput.value = rule_id;
}
/*
** On opening the options page, fetch stored settings and update the UI with them.
*/
const gettingStoredSettings = browser.storage.local.get();
gettingStoredSettings.then(updateUI, onError);
/*
** Add Event Listener On click event of add rules button.
*/
const addRulesButton = document.getElementById("add-new-rule");
addRulesButton.addEventListener("click", addNewRule);
/*
** Add Event Listener On click event of delete button.
*/
const deleteButton = document.getElementById("delete_rule");
deleteButton.addEventListener("click", deleteSettings);
/*
** Add Event Listener On blur event of Background Trigger URL input.
*/
triggerUriInput.addEventListener("blur", function( event ) {
	if(event.target.value !== "") {// If Background Trigger URL is provided, Background Interval is required
    loopIntervalInput.setAttribute("required","required");
  }
  else {loopIntervalInput.removeAttribute("required");}
  /* Duplicate URL Checking */
  for (var key in aliveRules) {
    if (aliveRules.hasOwnProperty(key)) {
      if (aliveRules[key].rule_disable || key == ruleIdInput.value || ruleDisableInput.checked) { continue; }
      if(event.target.value !== "" && event.target.value.replace(/\/$/, '').toLowerCase() == aliveRules[key].trigger_uri.replace(/\/$/, '').toLowerCase()) {
        triggerUriInput.setCustomValidity("This URL is already used in another Rule! Please disable or delete that Rule first.");
        triggerUriFb.innerHTML = 'This URL is already used in another Rule! Please disable or delete that Rule first.';
        break;
      }
      else { // Clear the Custom Validity Check
        triggerUriInput.setCustomValidity("");
        triggerUriFb.innerHTML = 'Valid trigger URL (including "http://" or "https://") is required.';
      }
    }
  }
}, true);
/*
** Add Event Listener On blur event of Foreground Auto-Reload Trigger URL input.
*/
fgTriggerUriInput.addEventListener("blur", function( event ) {
	if(event.target.value !== "") {// If Foreground Auto-Reload Trigger URL is provided, Foreground Interval is required
    fgIntervalInput.setAttribute("required","required");
    triggerUriInput.removeAttribute("required");
    triggerUriInput.setCustomValidity("");
    loopIntervalInput.removeAttribute("required");
  }
	else {//Reset required attributes if cleared
    fgIntervalInput.removeAttribute("required");
    triggerUriInput.setAttribute("required","required");
    loopIntervalInput.setAttribute("required","required");
  }
  /* Duplicate URL Checking */
  for (var key in aliveRules) {
    if (aliveRules.hasOwnProperty(key)) {
      if (aliveRules[key].rule_disable || key == ruleIdInput.value || ruleDisableInput.checked) { continue; }
      if(event.target.value !== "" && event.target.value.replace(/\/$/, '').toLowerCase() == aliveRules[key].fg_trigger_uri.replace(/\/$/, '').toLowerCase()) {
        fgTriggerUriInput.setCustomValidity("This URL is already used in another Rule! Please disable or delete that Rule first.");
        fgTriggerUriFb.innerHTML = 'This URL is already used in another Rule! Please disable or delete that Rule first.';
        break;
      }
      else { // Clear the Custom Validity Check
        fgTriggerUriInput.setCustomValidity("");
        fgTriggerUriFb.innerHTML = 'Valid trigger URL (including "http://" or "https://") is required.';
      }
    }
  }
}, true);
/*
** Add Event Listener change event of Disable Rule check-box
*/
ruleDisableInput.addEventListener("change", function( event ) {
  if (!event.target.checked) {
    for (var key in aliveRules) {
      if (aliveRules.hasOwnProperty(key)) {
        if (aliveRules[key].rule_disable || key == ruleIdInput.value) { continue; }
        if(fgTriggerUriInput.value !== "" && fgTriggerUriInput.value.replace(/\/$/, '').toLowerCase() == aliveRules[key].fg_trigger_uri.replace(/\/$/, '').toLowerCase()) {
          fgTriggerUriInput.setCustomValidity("This URL is already used in another Rule! Please disable or delete that Rule first.");
          fgTriggerUriFb.innerHTML = 'This URL is already used in another Rule! Please disable or delete that Rule first.';
          break;
        }
        if(triggerUriInput.value !== "" && triggerUriInput.value.replace(/\/$/, '').toLowerCase() == aliveRules[key].trigger_uri.replace(/\/$/, '').toLowerCase()) {
          triggerUriInput.setCustomValidity("This URL is already used in another Rule! Please disable or delete that Rule first.");
          triggerUriFb.innerHTML = 'This URL is already used in another Rule! Please disable or delete that Rule first.';
          break;
        }
      }
    }
  } else {
    fgTriggerUriInput.setCustomValidity("");
    triggerUriInput.setCustomValidity("");
  }
},true);
// Add Event Listener - Sidebar Collapse - Toggle
document.getElementById("sidebar-collapse").addEventListener("click", function() {
  document.getElementById("sidebar").classList.toggle("active");
  if (this.firstChild.data == "«") this.firstChild.data = "»";
  else this.firstChild.data = "«";
});
// Add Event Listener - Background Advanced Settings accordion - Toggle
document.getElementById("settings-bg-advanced").addEventListener("click", function() {
  document.getElementById("accordion-settings-bg-advanced").classList.toggle("show"); });
// Add Event Listener - Foreground Settings accordion - Toggle
document.getElementById("settings-foreground").addEventListener("click", function() {
  document.getElementById("accordion-settings-foreground").classList.toggle("show"); });
// Add Event Listener - Notification Settings accordion - Toggle
document.getElementById("settings-notifications").addEventListener("click", function() {
  document.getElementById("accordion-settings-notifications").classList.toggle("show"); });
// Add Event Listener - beep sound test
document.getElementById("sound_test").addEventListener("click", function() {
  document.getElementById("sound_element").play(); });
// Disabling form submissions if there are invalid fields
window.addEventListener("load", function() {
  // Fetch all the forms we want to apply custom Bootstrap validation styles to
  var forms = document.getElementsByClassName("needs-validation");
  // Loop over them and prevent submission
  var validation = Array.prototype.filter.call(forms, function(form) {
    form.addEventListener("submit", function(event) {
      if (form.checkValidity() === false) {
        event.preventDefault();
        event.stopPropagation();
      }
      else {
        // If validated Save the settings
        storeSettings();
      }
      form.classList.add("was-validated");
    }, false);
  });
}, false);
/*
 * Debug Storage - Log to console for Storage Changes
 *
 * @param {changes, area} changes Object contains the changed objects of storage area {area}
*/
function logStorageChange(changes, area) {
  var changedItems = Object.keys(changes);
  for (var item of changedItems) {
    if(changes[item].oldValue) { console.log(item + " has changed:\n Old value: "); console.log(changes[item].oldValue); }
    else { console.log(item + " has Added:"); }
    console.log("\n New value: "); console.log(changes[item].newValue);
  }
}
/*
** Add Event Listener to Log the Storage Change details
*/
browser.storage.onChanged.addListener(logStorageChange);
/**
 * Object storing all rules, keyed by rule ID.
 * @type {Object.<string, Object>}
 */
let aliveRules = {};

/**
 * ID of the currently selected rule, or null if none is selected.
 * @type {string|null}
 */
let selectedRuleId = null;

// Get Elements in Page
const ruleIdInput = document.getElementById("rule_id");
const ruleNameInput = document.getElementById("rule_name");
const ruleDisableInput = document.getElementById("disable_rule");
const triggerUriInput = document.getElementById("trigger_uri");
const loopUriInput = document.getElementById("loop_uri");
const loopIntervalInput = document.getElementById("loop_interval");
const loopExit200Input = document.getElementById("loop_exit_200");
const bgHeadOnlyInput = document.getElementById("bg_head_only");

// const jsInjectInput = document.getElementById("js_inject");
// const jsTriggerUriInput = document.getElementById("js_trigger_uri");
// const removeCookiesInput = document.getElementById("remove_cookies");

const fgTriggerUriInput = document.getElementById("fg_trigger_uri");
const fgIntervalInput = document.getElementById("fg_interval");
const fgReloadSoundInput = document.getElementById("fg_reload_sound");

const notifBgrequestInput = document.getElementById("notif_bgrequest");
const notifBgexitInput = document.getElementById("notif_bgexit");
const notifFgreloadInput = document.getElementById("notif_fgreload");
const notifFgexitInput = document.getElementById("notif_fgexit");

const triggerUriLink = document.getElementById("trigger_uri_link");
const triggerUriFb = document.getElementById("trigger_uri_fb");

/**
 * Regular expression for matching wildcard characters in URLs.
 * @type {RegExp}
 */
const REGEXP_WILDCARD = /(\*)/g;

/**
 * Regular expression for escaping special characters in URLs.
 * @type {RegExp}
 */
const REGEXP_ESCAPE = /[.+\-?^${}()|[\]\\]/g;

const themeSwitch = document.getElementById('themeSwitch');

/**
 * Applies the specified theme to the document.
 * @param {boolean} isDark - Whether to apply the dark theme (true) or light theme (false).
 */
function applyTheme(isDark) {
    document.documentElement.setAttribute('data-bs-theme', isDark ? 'dark' : 'light');
    themeSwitch.checked = isDark;
}

/**
 * Initializes the theme based on system preferences.
 */
function initializeTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark);
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    applyTheme(e.matches);
});

// Handle manual theme switch
themeSwitch.addEventListener('change', () => {
    applyTheme(themeSwitch.checked);
});

// Initialize theme on load
initializeTheme();

/**
 * Logs an error to the console.
 * @param {Error|string} error - The error object or message to log.
 */
function onError(e) { console.error("Error: " + e); }

/**
 * Displays a temporary alert message in the UI.
 * @param {string} message - The message to display in the alert.
 */
function showAlert(message) {
    const alertContainer = document.getElementById('alertContainer');
    const alertId = `alert-${Date.now()}`; // Unique ID for each alert
    const alertDiv = document.createElement('div');
    alertDiv.id = alertId;
    alertDiv.className = 'alert alert-success alert-dismissible show';
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
                ${message}
                <button type="button" class="btn-close" aria-label="Close"></button>
            `;
    alertContainer.appendChild(alertDiv);

    // Attach close button handler
    const closeButton = alertDiv.querySelector('.btn-close');
    closeButton.onclick = () => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 300); // Remove after fade-out
    };

    // Auto-hide after 3 seconds
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 300); // Remove after fade-out
    }, 3000);
}

/**
 * Renders the list of rules in the sidebar.
 * @param {Object.<string, Object>} aliveSettings - Object containing rule settings, keyed by rule ID.
 */
function renderRules(aliveSettings) {
    aliveRules = aliveSettings;
    const rulesList = document.getElementById('rulesList');
    rulesList.innerHTML = '';
    // No rules configured. Show an alert
    if (Object.keys(aliveRules).length === 0) {
        rulesList.innerHTML = `
            <div class="alert alert-info text-center" role="alert">
                No rules found.
            </div>
        `;
    }
    // Iterate through the keys in {aliveSettings} Object
    for (var key in aliveSettings) {
        if (aliveSettings.hasOwnProperty(key)) {
            const aliveRule = document.createElement("div");
            aliveRule.className = `text-truncate rule-item ${selectedRuleId === key ? 'active' : ''}`;
            aliveRule.textContent = aliveSettings[key].rule_name;
            aliveRule.id = key;
            aliveRule.dataset.id = key;
            rulesList.appendChild(aliveRule);
        }
    }
}

/**
 * Shows the rule form for adding or editing a rule.
 */
function showForm() {
    document.getElementById('ruleFormCard').classList.remove('d-none');
    document.getElementById('addNewRuleButton').classList.add('d-none');
    document.getElementById('helpCard').classList.add('d-none');
    document.getElementById('save-success-next-step').classList.add('d-none');
    window.scrollTo({ top: 0 });
}

/**
 * Hides the rule form and shows the add rule button and help card.
 */
function hideForm() {
    document.getElementById('ruleFormCard').classList.add('d-none');
    document.getElementById('addNewRuleButton').classList.remove('d-none');
    document.getElementById('helpCard').classList.remove('d-none');
    window.scrollTo({ top: 0 });
}

/**
 * Resets the rule form to its initial state.
 */
function resetForm() {
    document.getElementById('ruleForm').reset();
    document.getElementById('ruleForm').classList.remove('was-validated');
    document.getElementById('formTitle').textContent = 'Add New Rule';
    document.getElementById('submitButton').textContent = 'Add Rule';
    document.getElementById('deleteButton').style.display = 'none';
    selectedRuleId = null;
    renderRules(aliveRules);
    hideForm();
}

/**
 * Handles successful storage of a rule and updates the UI.
 * @returns {Promise<void>} Resolves when the UI is updated.
 */
function setItem() {
    console.log("Store Settings Successful!");
    selectedRuleId = null;
    const refreshSettings = browser.storage.local.get();
    refreshSettings.then(renderRules, onError).then(function () {
        hideForm();
        showAlert('<strong>Success!</strong> Rule Saved Successfully.');
    });
}

/**
 * Handles successful deletion of a rule and updates the UI.
 * @returns {Promise<void>} Resolves when the UI is updated.
 */
function removedItem() {
    console.log("Delete Settings Successful!");
    selectedRuleId = null;
    const refreshSettings = browser.storage.local.get();
    refreshSettings.then(renderRules, onError).then(function () {
        hideForm();
        showAlert('<strong>Success!</strong> Rule Deleted Successfully.');
    });
}

// Handle Add New Rule button
document.getElementById('addNewRuleButton').addEventListener('click', function () {
    resetForm();
    document.getElementById('formTitle').textContent = 'Add New Rule';
    document.getElementById('submitButton').textContent = 'Add Rule';
    // Select default settings
    ruleIdInput.value = "sa" + (new Date()).getTime();
    loopExit200Input.checked = true;
    fgReloadSoundInput.checked = true;
    notifBgexitInput.checked = true;
    notifFgexitInput.checked = true;
    triggerUriInput.setAttribute("required", "required");
    loopIntervalInput.setAttribute("required", "required");
    fgIntervalInput.removeAttribute("required");
    showForm();
});

// Handle rule selection
document.getElementById('rulesList').addEventListener('click', function (e) {
    const ruleItem = e.target.closest('.rule-item');
    if (ruleItem) {
        resetForm();
        selectedRuleId = ruleIdInput.value = ruleItem.dataset.id;
        const gettingSettingsByKey = browser.storage.local.get(selectedRuleId);
        gettingSettingsByKey.then(updateEditor, onError);
        document.getElementById('formTitle').textContent = 'Edit Rule';
        document.getElementById('submitButton').textContent = 'Update Rule';
        document.getElementById('deleteButton').style.display = 'inline-block';
        showForm();
        renderRules(aliveRules);
    }
});

// Handle delete button
document.getElementById('deleteButton').addEventListener('click', function () {
    let aliveRuleId = ruleIdInput.value;
    if (confirm("Are you sure you want to delete this rule?")) {
        return browser.storage.local.remove(aliveRuleId).then(removedItem, onError);
    }
});

// Handle cancel button
document.getElementById('cancelButton').addEventListener('click', function () {
    resetForm();
});

/**
 * Stores the current rule settings in browser.storage.local.
 * @returns {Promise<void>} Resolves when the settings are stored.
 */
function storeSettings() {
    var rules = {};
    var aliveRuleId = ruleIdInput.value;
    var parsed, loop_interval_value, fg_interval_value, aliveSettings;

    parsed = parseInt(loopIntervalInput.value, 10);
    loop_interval_value = (isNaN(parsed) || parsed === 0) ? "" : parsed;

    parsed = parseInt(fgIntervalInput.value, 10);
    fg_interval_value = (isNaN(parsed) || parsed === 0) ? "" : parsed;

    if (!ruleDisableInput.checked) {
        document.getElementById("save-success-next-step").classList.remove('d-none');
        triggerUriLink.href = (fgTriggerUriInput.value && fgTriggerUriInput.value !== "") ? fgTriggerUriInput.value : triggerUriInput.value;
        // Check for Wildcard and trim wildcard
        if (triggerUriLink.href.indexOf('*') > -1) {
            triggerUriLink.href = triggerUriLink.href.substring(0, triggerUriLink.href.indexOf('*'));
        }
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
        // js_inject: jsInjectInput.value,
        // js_trigger_uri: jsTriggerUriInput.value,
        // remove_cookies: removeCookiesInput.value,
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
    return browser.storage.local.set(rules).then(setItem, onError);
}
/**
 * Updates the rule editor form with the settings of the selected rule.
 * @param {Object.<string, Object>} aliveSettings - Object containing settings of the selected rule, keyed by rule ID.
 */
function updateEditor(aliveSettings) {
    // Iterate through the keys in {aliveSettings} Object
    for (var key in aliveSettings) {
        if (aliveSettings.hasOwnProperty(key)) {
            ruleNameInput.value = aliveSettings[key].rule_name;
            ruleDisableInput.checked = aliveSettings[key].rule_disable;
            triggerUriInput.value = aliveSettings[key].trigger_uri;
            loopUriInput.value = aliveSettings[key].loop_uri;
            loopIntervalInput.value = aliveSettings[key].loop_interval;
            loopExit200Input.checked = aliveSettings[key].loop_exit_200;
            bgHeadOnlyInput.checked = aliveSettings[key].bg_head_only;

            // jsInjectInput.value = aliveSettings[key].js_inject;
            // jsTriggerUriInput.value = aliveSettings[key].js_trigger_uri;
            // removeCookiesInput.value = aliveSettings[key].remove_cookies;

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
    if (triggerUriInput.value !== "") { loopIntervalInput.setAttribute("required", "required"); }
    else { loopIntervalInput.removeAttribute("required"); }
    // Set auto reload loop interval as required if foreground trigger URL existing
    if (fgTriggerUriInput.value !== "") {
        fgIntervalInput.setAttribute("required", "required");
        triggerUriInput.removeAttribute("required");
        loopIntervalInput.removeAttribute("required");
    }
    else {
        fgIntervalInput.removeAttribute("required");
        triggerUriInput.setAttribute("required", "required");
        loopIntervalInput.setAttribute("required", "required");
    }
}

/**
 * Saves imported rules to browser.storage.local.
 * @param {Object.<string, Object>} aliveData - Object containing rules to save, keyed by rule ID.
 * @returns {Promise<void>} Resolves when the rules are saved.
 */
function saveRules(aliveData) {
    return browser.storage.local.set(aliveData).then(setItem, onError);
}

/**
 * Handles importing rules from a JSON file.
 */
function handleImport() {
    try {
        var raw = JSON.parse(reader.result);
        // Filter the raw data with Session Alive key
        var aliveData = Object.keys(raw)
            .filter(key => key.startsWith('sa'))
            .reduce((obj, key, index) => {
                if (document.getElementById("import_append").checked) {
                    // Generate new rule id if the append option is selected
                    var ruleNewId = "sa" + (new Date()).getTime() + (index + 10);
                    obj[ruleNewId] = raw[key];
                } else {
                    obj[key] = raw[key];
                }
                return obj;
            }, {});
        var totRules = Object.keys(aliveData).length;//Get No. of Rules
        if (totRules === 0) {
            alert("Selected JSON file does not contain valid rules!");
        } else {
            // Confirm replacing the rules before clearing storage if the replace option is selected
            if (document.getElementById("import_replace").checked) {
                if (confirm("Are you sure you want to replace all rules?")) {
                    browser.storage.local.clear()
                        .then(saveRules(aliveData), onError);
                } else {
                    return;
                }
            } else {
                // Append the rules
                saveRules(aliveData);
            }
        }
    } catch (error) {
        alert("Selected file is not a valid JSON file!");
    }
    return Promise.resolve();
}

/**
 * Exports all rules as a JSON file for download.
 */
function exportSettings() {
    var totRules = Object.keys(aliveRules).length;//Get No. of Rules
    if (totRules === 0) {
        alert("No rules found to export!");
    } else {
        const blob = new Blob([JSON.stringify(aliveRules, null, 2)], { type: "application/json" });
        const file = new File([blob], "session_alive_rules.json", { type: "application/json" });
        const link = document.createElement("a");
        link.download = "session_alive_rules.json";
        link.href = window.URL.createObjectURL(file);
        link.click();
        link.remove();
    }
}

/**
 * On opening the options page, fetch stored settings and update the UI with them.
 */
const gettingStoredSettings = browser.storage.local.get();
gettingStoredSettings.then(renderRules, onError);

/**
 * Add Event Listener for File Reader for JSON Import
 * Add Event Listener On change event of File select field.
 * Add Event Listener On click event of Import rules button.
 */
const reader = new FileReader();
reader.addEventListener("loadend", handleImport);
const importButton = document.getElementById("import_rules_json");
const fileElem = document.getElementById("fileElem");
fileElem.addEventListener("change", () => {
    if (fileElem.files.length == 1) {
        reader.readAsText(fileElem.files[0]);
    }
},
    false
);
importButton.addEventListener("click", (e) => {
    if (fileElem) {
        // Trigger the File select field
        fileElem.value = '';
        fileElem.click();
    }
},
    false,
);

/**
 * Add Event Listener On click event of Export rules button.
 */
const exportButton = document.getElementById("export_rules_json");
exportButton.addEventListener("click", exportSettings);

/**
 * Add Event Listener On blur event of Background Trigger URL input.
*/
triggerUriInput.addEventListener("blur", function (event) {
    if (event.target.value !== "") {// If Background Trigger URL is provided, Background Interval is required
        loopIntervalInput.setAttribute("required", "required");
    }
    else { loopIntervalInput.removeAttribute("required"); }
    /* Duplicate URL Checking */
    var duplicate = false;
    var AddUrlMatch, TriggerUrlMatch;
    for (var key in aliveRules) {
        if (aliveRules.hasOwnProperty(key)) {
            if (aliveRules[key].rule_disable || key == ruleIdInput.value || ruleDisableInput.checked) { continue; }
            if (event.target.value !== "" && event.target.value.replace(/\/$/, '').toLowerCase() == aliveRules[key].trigger_uri.replace(/\/$/, '').toLowerCase()) {
                triggerUriInput.setCustomValidity("This URL is already used in another Rule! Please disable or delete that Rule first.");
                triggerUriFb.innerHTML = 'This URL is already used in another Rule! Please disable or delete that Rule first.';
                duplicate = true;
                break;
            }
            /* Duplicate URL Checking for WildCard URLs*/
            if (event.target.value.indexOf('*') >= 0) {
                let re = new RegExp(event.target.value.replace(/\/$/, '').replace(/\/\*$/, '*').toLowerCase().replace(REGEXP_ESCAPE, '\\$&').replace(REGEXP_WILDCARD, '\.$1'));
                AddUrlMatch = re.test(aliveRules[key].trigger_uri.replace(/\/$/, '').toLowerCase());
            }
            if (aliveRules[key].trigger_uri.indexOf('*') >= 0) {
                let re = new RegExp(aliveRules[key].trigger_uri.replace(/\/$/, '').replace(/\/\*$/, '*').toLowerCase().replace(REGEXP_ESCAPE, '\\$&').replace(REGEXP_WILDCARD, '\.$1'));
                TriggerUrlMatch = re.test(event.target.value.replace(/\/$/, '').toLowerCase());
            }
            if (AddUrlMatch || TriggerUrlMatch) {
                triggerUriInput.setCustomValidity("This URL is already used in another Rule! Please disable or delete that Rule first.");
                triggerUriFb.innerHTML = 'This URL is already used in another Rule! Please disable or delete that Rule first.';
                duplicate = true;
                break;
            }
            if (!duplicate) { // Clear the Custom Validity Check
                triggerUriInput.setCustomValidity("");
                triggerUriFb.innerHTML = 'Valid trigger URL (including "http://" or "https://") is required.';
            }
        }
    }
}, true);

/**
 * Add Event Listener On blur event of Foreground Auto-Reload Trigger URL input.
*/
fgTriggerUriInput.addEventListener("blur", function (event) {
    if (event.target.value !== "") {// If Foreground Auto-Reload Trigger URL is provided, Foreground Interval is required
        fgIntervalInput.setAttribute("required", "required");
        triggerUriInput.removeAttribute("required");
        triggerUriInput.setCustomValidity("");
        loopIntervalInput.removeAttribute("required");
    }
    else {//Reset required attributes if cleared
        fgIntervalInput.removeAttribute("required");
        triggerUriInput.setAttribute("required", "required");
        loopIntervalInput.setAttribute("required", "required");
    }
    /* Duplicate URL Checking */
    for (var key in aliveRules) {
        if (aliveRules.hasOwnProperty(key)) {
            if (aliveRules[key].rule_disable || key == ruleIdInput.value || ruleDisableInput.checked) { continue; }
            if (event.target.value !== "" && event.target.value.replace(/\/$/, '').toLowerCase() == aliveRules[key].fg_trigger_uri.replace(/\/$/, '').toLowerCase()) {
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

/**
 * Add Event Listener change event of Disable Rule check-box
*/
ruleDisableInput.addEventListener("change", function (event) {
    if (!event.target.checked) {
        for (var key in aliveRules) {
            if (aliveRules.hasOwnProperty(key)) {
                if (aliveRules[key].rule_disable || key == ruleIdInput.value) { continue; }
                if (fgTriggerUriInput.value !== "" && fgTriggerUriInput.value.replace(/\/$/, '').toLowerCase() == aliveRules[key].fg_trigger_uri.replace(/\/$/, '').toLowerCase()) {
                    fgTriggerUriInput.setCustomValidity("This URL is already used in another Rule! Please disable or delete that Rule first.");
                    fgTriggerUriFb.innerHTML = 'This URL is already used in another Rule! Please disable or delete that Rule first.';
                    break;
                }
                if (triggerUriInput.value !== "" && triggerUriInput.value.replace(/\/$/, '').toLowerCase() == aliveRules[key].trigger_uri.replace(/\/$/, '').toLowerCase()) {
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
}, true);

// Add Event Listener - beep sound test
document.getElementById("sound_test").addEventListener("click", function () {
    document.getElementById("sound_element").play();
});

// Disabling form submissions if there are invalid fields
window.addEventListener("load", function () {
    // Fetch all the forms we want to apply custom Bootstrap validation styles to
    var forms = document.getElementsByClassName("needs-validation");
    // Loop over them and prevent submission
    var validation = Array.prototype.filter.call(forms, function (form) {
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (form.checkValidity()) {
                // Save settings when the form is valid
                storeSettings();
            }
            form.classList.add("was-validated");
        }, false);
    });
}, false);

/**
 * Debug Storage - Log to console for Storage Changes
 * @param {changes, area} changes Object contains the changed objects of storage area {area}
 */
function logStorageChange(changes, areaName) {
    // Listen for storage.local changes only
    if (areaName !== 'local') return;
    var changedItems = Object.keys(changes);
    for (var item of changedItems) {
        if (changes[item].oldValue) { console.log(item + " has changed:\n Old value: "); console.log(changes[item].oldValue); }
        else { console.log(item + " has Added:"); }
        console.log("\n New value: "); console.log(changes[item].newValue);
    }
}

//Add Event Listener to Log the Storage Change details
browser.storage.onChanged.addListener(logStorageChange);

// Accordion collapse/ expand
document.querySelectorAll('.accordion-button').forEach(button => {
    button.addEventListener('click', () => {
        const targetId = button.getAttribute('data-bs-target');
        const content = document.querySelector(targetId);
        button.classList.toggle("collapsed");
        content.classList.toggle("show");
    });
});
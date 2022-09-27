'use strict';

// --- Default Settings
var debug = false;
var networkEnabled = true;

// A list of Labs-trusted explorers
const arrExplorers = [
    // Display name      Blockbook-compatible API base    
    { name: "freedomcoin", url: "https://chain.freedomcoin.global" },
    { name: "rockdev",   url: "https://explorer.rockdev.org" }
]

var cExplorer = arrExplorers[0];

// Users need not look below here.
// ------------------------------
// Global Keystore / Wallet Information
var publicKeyForNetwork;
var privateKeyForTransactions;
var fWalletLoaded = false;

// --- DOM Cache
const domNetwork = document.getElementById('Network');
const domDebug = document.getElementById('Debug');

// Display the default settings directly in the UI
domNetwork.innerHTML = '<b> Network:</b> ' + (networkEnabled ? 'Enabled' : 'Disabled');
domDebug.innerText = debug ? '<b>DEBUG MODE ON</b>' : '';

// --- Settings Functions
function setExplorer(explorer) {
    cExplorer = explorer;
    enableNetwork();
    createAlert('success', '<b>Switched explorer!</b><br>Now using ' + cExplorer.name, 3500);
}
// Hook up the 'explorer' select UI
document.getElementById('explorer').onchange = function(evt) {
    setExplorer(arrExplorers.find(a => a.url === evt.target.value));
}

function toggleDebug() {
    debug = !debug;
    domDebug.innerHTML = debug ? '<b>DEBUG MODE ON</b>' : '';
}

function toggleNetwork() {
    networkEnabled = !networkEnabled;
    domNetwork.innerHTML = '<b> Network:</b> ' + (networkEnabled ? 'Enabled' : 'Disabled');
    return networkEnabled;
}

// Enable the network, return true if successful.
function enableNetwork() {
    if (!networkEnabled) return toggleNetwork();
    return false;
}

// Disable the network, return true if successful.
function disableNetwork() {
    if (networkEnabled) return !toggleNetwork();
    return false;
}

// Once the DOM is ready; plug-in any settings to the UI
addEventListener('DOMContentLoaded', () => {
    const domExplorerSelect = document.getElementById('explorer');

    // Add each trusted explorer into the UI selector
    for (const explorer of arrExplorers) {
        const opt = document.createElement('option');
        opt.value = explorer.url;
        opt.innerHTML = explorer.name;
        domExplorerSelect.appendChild(opt);
    }
});
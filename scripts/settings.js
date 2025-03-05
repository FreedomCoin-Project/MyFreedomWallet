'use strict';

// --- Default Settings
let debug = false;
let networkEnabled = true;

// A list of Labs-trusted explorers
const arrExplorers = [
    { name: "freedomcoin", url: "https://chain.freedomcoin.global" },
    { name: "cryptoid", url: "https://chainz.cryptoid.info/freed" }
];

let cExplorer = arrExplorers[0];

// --- Global Keystore / Wallet Information
let publicKeyForNetwork;
let privateKeyForTransactions;
let fWalletLoaded = false;

// --- DOM Cache
const domNetwork = document.getElementById('Network');
const networkIcons = document.querySelectorAll('#Network img');
const networkText = document.querySelector('#Network span');
const domDebug = document.getElementById('Debug');
const domExplorerSelect = document.getElementById('explorer');

// Initialize UI settings
networkText.textContent = networkEnabled ? 'On' : 'Off';
domDebug.textContent = debug ? 'DEBUG MODE ON' : '';

// --- Settings Functions
const setExplorer = (explorer) => {
    cExplorer = explorer;
    enableNetwork();
    createAlert('success', `<b>Switched explorer!</b><br>Now using ${cExplorer.name}`, 3500);
};

const toggleDebug = () => {
    debug = !debug;
    domDebug.textContent = debug ? 'DEBUG MODE ON' : '';
};

const toggleNetwork = () => {
    networkEnabled = !networkEnabled;

    // Toggle network icon visibility
    networkIcons[0].style.display = networkEnabled ? '' : 'none';
    networkIcons[1].style.display = networkEnabled ? 'none' : '';

    // Update UI text
    networkText.textContent = networkEnabled ? 'On' : 'Off';

    // Trigger hover effect for 2 seconds
    domNetwork.classList.add('hover');
    setTimeout(() => domNetwork.classList.remove('hover'), 2000);

    return networkEnabled;
};

// Enable or disable the network
const enableNetwork = () => networkEnabled ? false : toggleNetwork();
const disableNetwork = () => networkEnabled ? !toggleNetwork() : false;

// DOM Ready Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Populate explorer selector
    arrExplorers.forEach(({ name, url }) => {
        const option = document.createElement('option');
        option.value = url;
        option.textContent = name;
        domExplorerSelect.appendChild(option);
    });

    // Hook up the explorer change event
    domExplorerSelect.onchange = (evt) => {
        setExplorer(arrExplorers.find(e => e.url === evt.target.value));
    };
});

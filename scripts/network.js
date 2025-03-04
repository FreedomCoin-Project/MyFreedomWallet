'use strict';

// Function to handle network errors
function networkError() {
    if (disableNetwork()) {
        createAlert('warning',
            '<b>Failed to synchronize!</b> Please try again later.' +
            '<br>You can attempt re-connect via the Settings.');
    }
}

if (networkEnabled) {
    // Function to get the latest block count from the explorer API
    var getBlockCount = function () {
        var request = new XMLHttpRequest();
        request.open('GET', cExplorer.url + "/api/v2", true);
        request.onerror = networkError;
        request.onload = function () {
            try {
                const data = JSON.parse(this.response);
                domBalanceReload.classList.remove("playAnim");
                domBalanceReloadStaking.classList.remove("playAnim");
                
                // Update block count only if it's higher than cached
                if (data.backend.blocks > cachedBlockCount) {
                    $("#blocks").text("Last Block: " + data.backend.blocks);
                    getUTXOs(); // Fetch UTXOs when a new block is found
                }
                
                cachedBlockCount = data.backend.blocks;
            } catch (e) {
                console.error("Error parsing block count response:", e);
            }
        };
        request.send();
    };

    var arrUTXOsToValidate = [];

    // Function to validate and categorize UTXOs
    var acceptUTXO = () => {
        if (!arrUTXOsToValidate.length) return;

        const request = new XMLHttpRequest();
        request.open('GET', `${cExplorer.url}/api/v2/tx-specific/${arrUTXOsToValidate[0].txid}`, true);
        request.onerror = networkError;
        request.onload = function () {
            try {
                const responseData = JSON.parse(this.response);
                const cVout = responseData.vout[arrUTXOsToValidate[0].vout];

                // Create UTXO object
                const cUTXO = {
                    'id': arrUTXOsToValidate[0].txid,
                    'vout': cVout.n,
                    'sats': Math.round(cVout.value * COIN),
                    'script': cVout.scriptPubKey.hex
                };

                // Categorize UTXOs based on script type
                if (cVout.scriptPubKey.type === 'pubkeyhash') {
                    cachedUTXOs.push(cUTXO);
                } else if (cVout.scriptPubKey.type === 'coldstake') {
                    arrDelegatedUTXOs.push(cUTXO);
                }

                // Update balances
                getBalance(true);
                getStakingBalance(true);

                // Process the next UTXO if available
                arrUTXOsToValidate.shift();
                if (arrUTXOsToValidate.length) acceptUTXO();
            } catch (e) {
                console.error("Error parsing UTXO response:", e);
            }
        };
        request.send();
    };

    // Function to fetch UTXOs for a given public key
    var getUTXOs = () => {
        if (arrUTXOsToValidate.length) return;

        const request = new XMLHttpRequest();
        request.open('GET', `${cExplorer.url}/api/v2/utxo/${publicKeyForNetwork}`, true);
        request.onerror = networkError;
        request.onload = function () {
            try {
                arrUTXOsToValidate = JSON.parse(this.response);
                cachedUTXOs = [];
                arrDelegatedUTXOs = [];
                acceptUTXO(); // Process fetched UTXOs
                populateTransactionTable();
            } catch (e) {
                console.error("Error parsing UTXO response:", e);
            }
        };
        request.send();
    };

    // Function to broadcast a transaction
    var sendTransaction = function (hex, msg = '') {
        const request = new XMLHttpRequest();
        request.open('POST', `${cExplorer.url}/api/v2/sendtx`, true);
        request.setRequestHeader("Content-Type", "application/json");

        request.onerror = networkError;
        request.onreadystatechange = function () {
            if (this.readyState !== 4 || (this.status !== 200 && this.status !== 400)) return;

            try {
                const data = JSON.parse(this.response);

                if (data.result && data.result.length === 64) {
                    console.log('Transaction sent! ' + data.result);

                    let msg = domAddress1s.value !== donationAddress
                        ? "Your transaction was successful!"
                        : "Thank you for supporting MyFREEDWallet!💕";

                    domTxOutput.innerHTML = `
                        <span style="color:green">
                            ${msg}<br>
                            <a href="${cExplorer.url}/tx/${data.result}" target="_blank" 
                               style="width: 100%; overflow: hidden; text-overflow: ellipsis;">
                               ${data.result}
                            </a>
                        </span>`;
                    
                    domSimpleTXsTitleSpan.innerHTML = "Created a";
                    domSimpleTXs.style.display = 'none';
                    domAddress1s.value = domValue1s.value = '';

                    createAlert('success', msg, 1250 + (msg.length * 50));
                } else {
                    console.error('Error sending transaction:', data.error || this.response);
                    createAlert('warning', 'Transaction Failed!', 1250);
                    
                    let strError = data.error || this.response;
                    try {
                        strError = JSON.stringify(JSON.parse(this.response), null, 4);
                    } catch (e) {}

                    domTxOutput.innerHTML = `
                        <h4 style="color:red;font-family:mono !important;">
                            <pre style="color: inherit;">${strError}</pre>
                        </h4>`;
                }
            } catch (e) {
                console.error("Error parsing transaction response:", e);
            }
        };

        request.send(JSON.stringify({ rawtx: hex }));
    };

    // Function to estimate transaction fee
    var getFee = function (bytes) {
        return bytes * 50; // 50 sat/byte fee rate
    };
}
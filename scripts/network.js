'use strict';

// Handle network errors
tfunction networkError() {
    if (disableNetwork()) {
        createAlert(
            'warning',
            '<b>Failed to synchronize!</b> Please try again later.' +
            '<br>You can attempt re-connect via the Settings.'
        );
    }
}

if (networkEnabled) {
    // Fetch the latest block count from the explorer
    const getBlockCount = () => {
        const request = new XMLHttpRequest();
        request.open('GET', `${cExplorer.url}/api/v2/api`, true);
        request.onerror = networkError;
        request.onload = function () {
            const data = JSON.parse(this.response);
            
            // Remove animation class
            domBalanceReload.classList.remove("playAnim");
            domBalanceReloadStaking.classList.remove("playAnim");
            
            // If block count increased, refresh UTXOs
            if (data.backend.blocks > cachedBlockCount) {
                document.getElementById("blocks").textContent = `Last Block: ${data.backend.blocks}`;
                getUTXOs();
            }
            
            cachedBlockCount = data.backend.blocks;
        };
        request.send();
    };

    let arrUTXOsToValidate = [];
    
    // Validate and categorize UTXOs
    const acceptUTXO = () => {
        if (!arrUTXOsToValidate.length) return; // Exit if queue is empty
        
        const request = new XMLHttpRequest();
        request.open('GET', `${cExplorer.url}/api/v2/tx-specific/${arrUTXOsToValidate[0].txid}`, true);
        request.onerror = networkError;
        request.onload = function () {
            const cVout = JSON.parse(this.response).vout[arrUTXOsToValidate[0].vout];
            
            // Convert to required format
            const cUTXO = {
                id: arrUTXOsToValidate[0].txid,
                vout: cVout.n,
                sats: Math.round(cVout.value * COIN),
                script: cVout.scriptPubKey.hex
            };

            // Categorize based on script type
            if (cVout.scriptPubKey.type === 'pubkeyhash') {
                cachedUTXOs.push(cUTXO);
            } else if (cVout.scriptPubKey.type === 'coldstake') {
                arrDelegatedUTXOs.push(cUTXO);
            }

            // Update balances and process next UTXO
            getBalance(true);
            getStakingBalance(true);
            arrUTXOsToValidate.shift();
            if (arrUTXOsToValidate.length) acceptUTXO();
        };
        request.send();
    };

    // Retrieve all UTXOs for the current address
    const getUTXOs = () => {
        if (arrUTXOsToValidate.length) return; // Prevent duplicate fetches
        
        const request = new XMLHttpRequest();
        request.open('GET', `${cExplorer.url}/api/v2/utxo/${publicKeyForNetwork}`, true);
        request.onerror = networkError;
        request.onload = function () {
            arrUTXOsToValidate = JSON.parse(this.response);
            cachedUTXOs = [];
            arrDelegatedUTXOs = [];
            acceptUTXO();
            populateTransactionTable();
        };
        request.send();
    };

    // Broadcast a transaction to the network
    const sendTransaction = (hex, msg = '') => {
        const request = new XMLHttpRequest();
        request.open('GET', `${cExplorer.url}/api/v2/sendtx/${hex}`, true);
        request.onerror = networkError;
        request.onreadystatechange = function () {
            if (!this.response || (this.status !== 200 && this.status !== 400) || this.readyState !== 4) return;
            
            const data = JSON.parse(this.response);
            if (data.result && data.result.length === 64) {
                console.log(`Transaction sent! ${data.result}`);
                let successMsg = domAddress1s.value !== donationAddress 
                    ? "Your transaction was successful!"
                    : "Thank you for supporting MyFREEDWallet!💕";
                
                domTxOutput.innerHTML = `
                    <span style="color:green">
                        ${successMsg}<br>
                        <a href="${cExplorer.url}/tx/${data.result}" target="_blank" 
                           style="width: 100%; overflow: hidden; text-overflow: ellipsis;">
                           ${data.result}
                        </a>
                    </span>`;
                
                domSimpleTXsTitleSpan.innerHTML = "Created a";
                domSimpleTXs.style.display = 'none';
                domAddress1s.value = domValue1s.value = '';
                
                createAlert('success', successMsg || 'Transaction sent!', successMsg ? (1250 + (successMsg.length * 50)) : 1500);
            } else {
                console.error(`Error sending transaction: ${data.result}`);
                createAlert('warning', 'Transaction Failed!', 1250);
                
                let strError = data.error;
                try {
                    strError = JSON.stringify(JSON.parse(data), null, 4);
                } catch (e) {
                    console.log('Error parsing transaction response:', e);
                }
                
                domTxOutput.innerHTML = `<h4 style="color:red;font-family:mono !important;"><pre>${strError}</pre></h4>`;
            }
        };
        request.send();
    };

    // Calculate transaction fee based on byte size
    const getFee = (bytes) => bytes * 50; // 50 sat/byte
}

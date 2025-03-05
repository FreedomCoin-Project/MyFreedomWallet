'use strict';

async function networkError() {
    if (disableNetwork()) {
        createAlert(
            'warning',
            `<b>Failed to synchronize!</b> Please try again later.<br>You can attempt re-connect via the Settings.`
        );
    }
}

if (networkEnabled) {
    let getBlockCount = async () => {
        try {
            let response = await fetch(`${cExplorer.url}/api/v2`);
            if (!response.ok) throw new Error('Network response was not ok');
            let data = await response.json();

            domBalanceReload.classList.remove("playAnim");
            domBalanceReloadStaking.classList.remove("playAnim");

            if (data.backend.blocks > cachedBlockCount) {
                document.getElementById("blocks").textContent = `Last Block: ${data.backend.blocks}`;
                getUTXOs();
            }
            cachedBlockCount = data.backend.blocks;
        } catch (error) {
            networkError();
            console.error('Error fetching block count:', error);
        }
    };

    let arrUTXOsToValidate = [];

    let acceptUTXO = async () => {
        if (!arrUTXOsToValidate.length) return;

        try {
            let response = await fetch(`${cExplorer.url}/api/v2/tx-specific/${arrUTXOsToValidate[0].txid}`);
            if (!response.ok) throw new Error('Network response was not ok');
            let { vout } = await response.json();

            let cVout = vout[arrUTXOsToValidate[0].vout];

            let cUTXO = {
                id: arrUTXOsToValidate[0].txid,
                vout: cVout.n,
                sats: Math.round(cVout.value * COIN),
                script: cVout.scriptPubKey.hex
            };

            if (cVout.scriptPubKey.type === 'pubkeyhash') {
                cachedUTXOs.push(cUTXO);
            } else if (cVout.scriptPubKey.type === 'coldstake') {
                arrDelegatedUTXOs.push(cUTXO);
            }

            getBalance(true);
            getStakingBalance(true);

            arrUTXOsToValidate.shift();
            if (arrUTXOsToValidate.length) acceptUTXO();
        } catch (error) {
            console.error('Error validating UTXO:', error);
        }
    };

    let getUTXOs = async () => {
        if (arrUTXOsToValidate.length) return;

        try {
            let response = await fetch(`${cExplorer.url}/api/v2/utxo/${publicKeyForNetwork}`);
            if (!response.ok) throw new Error('Network response was not ok');
            arrUTXOsToValidate = await response.json();

            cachedUTXOs = [];
            arrDelegatedUTXOs = [];

            acceptUTXO();
            populateTransactionTable();
        } catch (error) {
            networkError();
            console.error('Error fetching UTXOs:', error);
        }
    };

    let sendTransaction = async (hex, msg = '') => {
        try {
            let response = await fetch(`${cExplorer.url}/api/v2/sendtx/${hex}`);
            if (!response.ok) throw new Error('Network response was not ok');
            let data = await response.json();

            if (data.result && data.result.length === 64) {
                console.log('Transaction sent!', data.result);

                let message = domAddress1s.value !== donationAddress
                    ? "Your transaction was successful!"
                    : "Thank you for supporting MyFREEDWallet!💕";

                domTxOutput.innerHTML = `
                    <span style="color:green">
                        ${message}<br>
                        <a href="${cExplorer.url}/tx/${data.result}" target="_blank"
                           style="width: 100%; overflow: hidden; text-overflow: ellipsis;">
                           ${data.result}
                        </a>
                    </span>`;
                domSimpleTXsTitleSpan.textContent = "Created a";
                domSimpleTXs.style.display = 'none';
                domAddress1s.value = domValue1s.value = '';

                createAlert('success', message || 'Transaction sent!', message ? (1250 + (message.length * 50)) : 1500);
            } else {
                console.error('Error sending transaction:', data.result);
                createAlert('warning', 'Transaction Failed!', 1250);

                let errorText = data.error;
                try {
                    errorText = JSON.stringify(JSON.parse(data), null, 4);
                } catch (e) {
                    console.log('Error parsing JSON:', e);
                }

                domTxOutput.innerHTML = `<h4 style="color:red;font-family:mono !important;">
                    <pre style="color: inherit;">${errorText}</pre></h4>`;
            }
        } catch (error) {
            console.error('Transaction error:', error);
            createAlert('warning', 'Transaction Failed!', 1250);
        }
    };

    let getFee = (bytes) => bytes * 50; // Temporary fixed fee: 50 sat/byte
}

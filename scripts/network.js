'use strict';
/*
function networkError() {
    if (disableNetwork()) {
        createAlert('warning',
                    '<b>Failed to synchronize!</b> Please try again later.' +
                    '<br>You can attempt re-connect via the Settings.');
    }
}
*/
function networkError() {
  console.warn(`Network request failed for ${cExplorer.name} (${cExplorer.url}). Switching to backup explorer.`);
  
  // Switch to the backup explorer if not already using it
  if (cExplorer.url !== arrExplorers[1].url) {
      setExplorer(arrExplorers[1]);
  } else {
      console.error("Both explorers failed. Network requests cannot be completed.");
  }
}


if (networkEnabled) {
  // Initialize network variables
  var blockCountFailed = false;
  var isBlockCountPending = false;

  var getBlockCount = function() {
      if (isBlockCountPending) {
          console.warn("getBlockCount request is already pending. Rejecting new call.");
          return;  
      }
      isBlockCountPending = true;
      var request = new XMLHttpRequest();
      request.open('GET', cExplorer.url + "/api/v2", true);
      request.onerror = function() {
          blockCountFailed = true; // Mark failure
          isBlockCountPending = false;
          networkError(); 
      };
      request.onload = function () {
          isBlockCountPending = false;
          if (request.status !== 200) {
              blockCountFailed = true; // Mark failure if non-200 response
              return networkError();
          }
          try {
              const data = JSON.parse(this.response);
              blockCountFailed = false; // Reset failure flag on success
              
              domBalanceReload.classList.remove("playAnim");
              domBalanceReloadStaking.classList.remove("playAnim");
  
              if (data.backend.blocks > cachedBlockCount) {
                  $("#blocks").text("Last Block: "+ data.backend.blocks);
                  getUTXOs();
              }
              cachedBlockCount = data.backend.blocks;
          } catch (e) {
              blockCountFailed = true;
              networkError();
          }
      };
      
      request.send();
  };

  
  var arrUTXOsToValidate = [];
  var acceptUTXO = () => {
    // Cancel if the queue is empty: no wasting precious bandwidth & CPU cycles!
    if (!arrUTXOsToValidate.length) return;

    const request = new XMLHttpRequest();
    request.open('GET', cExplorer.url + "/api/v2/tx-specific/" + arrUTXOsToValidate[0].txid, true);
    request.onerror = networkError;

    request.onload = function() {
      // Fetch the single output of the UTXO
      const cVout = JSON.parse(this.response).vout[arrUTXOsToValidate[0].vout];

      // Convert to MPW format
      const cUTXO = {
        'id': arrUTXOsToValidate[0].txid,
        'vout': cVout.n,
        'sats': Math.round(cVout.value * COIN),
        'script': cVout.scriptPubKey.hex
      }

      // Determine the UTXO type, and use it accordingly
      if (cVout.scriptPubKey.type === 'pubkeyhash') {
        // P2PKH type (Pay-To-Pub-Key-Hash)
        cachedUTXOs.push(cUTXO);
      } else
      if (cVout.scriptPubKey.type === 'coldstake') {
        // Cold Stake type
        arrDelegatedUTXOs.push(cUTXO);
      }

      // Shift the queue and update the UI
      getBalance(true);
      getStakingBalance(true);
      
      // Loop validation until queue is empty
      arrUTXOsToValidate.shift();
      if (arrUTXOsToValidate.length) acceptUTXO();
    }
    request.send();
  }

  var getUTXOs = () => {
      // Don't fetch UTXOs if we're already scanning for them!
      if (arrUTXOsToValidate.length) return;

      const request = new XMLHttpRequest();
      request.open('GET', cExplorer.url + "/api/v2/utxo/" + publicKeyForNetwork, true);
      request.onerror = networkError;
      request.onload = function() {
          arrUTXOsToValidate = JSON.parse(this.response);

          // Clear our UTXOs and begin accepting refreshed ones (TODO: build an efficient 'set merge' algo)
          cachedUTXOs = [];
          arrDelegatedUTXOs = [];
          acceptUTXO();

          // Call the function to populate the table with transactions
          populateTransactionTable();
      };
      request.send();
  };

  var sendTransaction = function(hex, msg = '') {
      const request = new XMLHttpRequest();
      request.open('GET', cExplorer.url + "/api/v2/sendtx/" + hex, true);
      request.onerror = networkError;
      request.onreadystatechange = function () {
          if (!this.response || (!this.status === 200 && !this.status === 400)) return;
          if (this.readyState !== 4) return;
          const data = JSON.parse(this.response);
          if (data.result && data.result.length === 64) {
              console.log('Transaction sent! ' + data.result);
              let msg = (domAddress1s.value !== donationAddress) 
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
              domSimpleTXsTitleSpan.innerHTML = "Created a"
              domSimpleTXs.style.display = 'none';
              domAddress1s.value = domValue1s.value = '';
              createAlert('success', msg || 'Transaction sent!', msg ? (1250 + (msg.length * 50)) : 1500);
          } else {
              console.log('Error sending transaction: ' + data.result);
              createAlert('warning', 'Transaction Failed!', 1250);
              // Attempt to parse and prettify JSON (if any), otherwise, display the raw output.
              let strError = data.error;
              try {
                  strError = JSON.stringify(JSON.parse(data), null, 4);
                  console.log('parsed');
              } catch(e){console.log('no parse!'); console.log(e);}
              domTxOutput.innerHTML = '<h4 style="color:red;font-family:mono !important;"><pre style="color: inherit;">' + strError + "</pre></h4>";
          }
      }
      request.send();
  }

  var getFee = function (bytes) {
    // TEMPORARY: Hardcoded fee per-byte
    return bytes * 50; // 50 sat/byte
  }
}

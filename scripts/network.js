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
function networkError(type) { 
    if (type == 1) {
        updateBalanceAndTransactions();
        return;
    } 
    if (disableNetwork()) {
            createAlert('warning', 'Your network is off!');
    } 
}


if (networkEnabled) {
  // Initialize network variables
  var blockCountFailed = false;
  var isBlockCountPending = false;
  var isFirstCall = true;
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
          networkError(1); 
      };
      request.onload = function () {
          isBlockCountPending = false;
          if (request.status !== 200) {
              blockCountFailed = true; // Mark failure if non-200 response
              return networkError(1);
          }
          try {
              const data = JSON.parse(this.response);
              blockCountFailed = false; // Reset failure flag on success
              
              $("#balance-box").removeClass("loading"); 
              domBalanceReloadStaking.classList.remove("playAnim");
  
              if (data.backend.blocks > cachedBlockCount) {
                    clearInterval(blockInterval);
                    $(".send_tx").show();
                    $(".sync_bl").hide();
                    $("#blocks").text("Last Block: "+ data.backend.blocks);
                    getUTXOs();
              }
              cachedBlockCount = data.backend.blocks;
          } catch (e) {
              blockCountFailed = true;
              networkError(1);
          }
      };

      // Apply a timeout only on the first call
      if (isFirstCall) {
          isFirstCall = false;
          request.timeout = 10000; // 10 seconds timeout
          request.ontimeout = function() {
              console.warn("getBlockCount request timed out.");
              blockCountFailed = true;
              isBlockCountPending = false;
              networkError(1);
          };
      }
      
      request.send();
  }; 
  
  var arrUTXOsToValidate = [];
  var acceptUTXO = () => {
      if (!arrUTXOsToValidate.length) return;

      const request = new XMLHttpRequest();
      request.open('GET', `${cExplorer.url}/api/v2/tx-specific/${arrUTXOsToValidate[0].txid}`, true);
      request.onerror = networkError;
      request.onload = processUTXO;
      request.send();
  };

  function processUTXO() {
    const cVout = JSON.parse(this.response).vout[arrUTXOsToValidate[0].vout];

    const cUTXO = {
        'id': arrUTXOsToValidate[0].txid,
        'vout': cVout.n,
        'sats': Math.round(cVout.value * COIN),
        'script': cVout.scriptPubKey.hex
    }

    if (cVout.scriptPubKey.type === 'pubkeyhash') {
        cachedUTXOs.push(cUTXO);
    } else if (cVout.scriptPubKey.type === 'coldstake') {
        arrDelegatedUTXOs.push(cUTXO);
    }

    // Remove processed UTXO from queue
    arrUTXOsToValidate.shift();

    // Continue processing until queue is empty
    if (arrUTXOsToValidate.length) {
        acceptUTXO();
    } else {
        // Update the balance **only after all UTXOs are added**
        getBalance(true);
        getStakingBalance(true);
    }
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

 
// Global flag to track if fetching is in progress
let isFetching = false; 
const tableBody = document.getElementById('transactionTableBody'); // Table body element

function updateBalanceAndTransactions() {
    var apiKey = "dfed93dffb52";
    var url = `https://chainz.cryptoid.info/freed/api.dws?q=multiaddr&active=${publicKeyForNetwork}&key=${apiKey}`;
    // Update transactions
    if (isFetching) {
      console.log('Fetch in progress, rejecting new call');
      return; // Exit if a fetch is already in progress
    }

    isFetching = true; // Lock: set fetching in progress

    $.getJSON(url, function(data) {
        if (!data.addresses || data.addresses.length === 0) {
            console.error("Invalid address data:", data);
            return;
        }

        // Update balance
        var balance = (data.addresses[0].final_balance || 0) / COIN; // Convert to proper format
        const formattedBalance = balance.toFixed((balance).toFixed(2).length >= 6 ? 0 : 2);
        domGuiBalance.innerText = formattedBalance; 
        $("#balance-box").removeClass("loading");  
        price_tick(Number(formattedBalance));
        sync_block();

        if ((data.txs).length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3">No transactions</td></tr>';
            $(tableBody).removeClass("large-box loading");
            return;
        }

        const moreLink = document.getElementById("more_transaction");
        var seenTxs = new Set(); // Track processed transaction hashes

        const rowsArray = new Array(data.txs.length); // Array to store rows in correct order
        
        console.log('data.txs', data.txs, data.txs.length);

        let completedRequests = 0; // Counter to track completed requests
        let uniqueTxs = [];
        (data.txs || []).forEach((tx, index) => {
            var txHash = tx.hash;
            if (seenTxs.has(txHash)) {
                return;
            }
            uniqueTxs.push(tx);
            seenTxs.add(txHash);
        });

        (uniqueTxs.slice(0, 5) || []).forEach((tx, index) => {
            var transactionType = checkTxType(tx, data.txs);

            // Transaction details
            var blockheight = tx.block_height || "N/A";
            var amount = ((tx.change || 0) / COIN).toFixed(2);
            var confirmations = tx.confirmations || 0;
            const time = new Date(tx.time_utc); // No need to multiply by 1000 since it's already in ISO format
            const formattedDate = time.toLocaleString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true, // Use 12-hour format with AM/PM
            });
            
            // Replace commas and slashes to match the desired format
            const finalFormattedDate = formattedDate.replace(/(\d+)\/(\d+)\/(\d+), (\d+:\d+ [AP]M)/, '$3/$1/$2 $4');
            var explorerUrl = `https://chainz.cryptoid.info/freed/tx.dws?${tx.hash}`;

            // If confirmations are greater than 100, display "100+"
            confirmations = confirmations > 100 ? "100+" : confirmations;

            // Create the row for this transaction
            rowsArray[index] = `
                <a class="transaction-row large-box" data-bheight="${blockheight}" href="${explorerUrl}" target="_blank">
                    <div class="details">
                        <div class="icon ${transactionType.toLowerCase()}"></div>  
                        <div class="type">
                            <span class="direction">${transactionType}</span> 
                            <div class="t-date">${finalFormattedDate}</div>
                        </div>
                    </div>
                    <div class="status">
                        <div class="t-amount">${amount} FREED</div>
                        <div class="t-status" style="color: ${confirmations ? 'green' : 'red'};">${confirmations}</div>
                    </div>
                </a>
            `;

            completedRequests++; 
            $("bal-text").text(completedRequests);
            // Once all requests are completed, append the rows in order
            if (completedRequests === 5) {
              tableBody.innerHTML = rowsArray.join(''); // Append only the first 5 rows
              $(tableBody).removeClass("large-box loading");
              moreLink.innerHTML = `<a href="https://chainz.cryptoid.info/freed/address.dws?${publicKeyForNetwork}" target="_blank">More</a>`
              isFetching = false; // Unlock: set fetching to false
            }
        });

    }).fail(function(error) {
        console.error("Error fetching balance and transactions:", error);
    });
}

let blockInterval;
function sync_block() {
    fetch("https://chainz.cryptoid.info/freed/api.dws?q=getblockcount")
        .then(response => response.text())
        .then(block => {
            let currentBlock = parseInt(block, 10) - 1000;
            $("#blocks").text("Current Block: " + currentBlock);
            $(".send_tx").hide();
            $(".sync_bl").show();
            // Clear any existing interval
            if (blockInterval) clearInterval(blockInterval);

            // Start interval to increment block every second (1000ms)
            blockInterval = setInterval(() => {
                currentBlock += Math.floor(Math.random() * 10) + 1; // Increment randomly between 1 to 10
                $("#blocks").text("Current Block: " + currentBlock);
                cachedBlockCount = currentBlock;
            }, 1000);
        });
}


function checkTxType(tx, allTxs) {
    let isSent = tx.change > 0;
    let isReceived = tx.change > 0;

    // Count occurrences of tx.hash in allTxs
    let hashCount = allTxs.filter(transaction => transaction.hash === tx.hash).length;

  //  if (hashCount > 2) return "Multiple-Transfers"; // New case for more than two occurrences
    if (hashCount > 1 && tx.n == 1) return "Self-Transfer"; // Still a self-transfer if it appears twice
    if (isSent && tx.n == 0) return "Sent";
    if (isReceived && hashCount == 1) return "Received";

    return "Unknown";

}



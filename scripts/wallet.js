// Generate a new private key OR encode an existing private key from raw bytes
generateOrEncodePrivkey = function (pkBytesToEncode) {
  // Private Key Generation
  const pkBytes = pkBytesToEncode || getSafeRand();
  const pkNetBytesLen = pkBytes.length + 2;
  const pkNetBytes = new Uint8Array(pkNetBytesLen);

  // Network Encoding
  pkNetBytes[0] = SECRET_KEY;           // Private key prefix (1 byte)
  writeToUint8(pkNetBytes, pkBytes, 1); // Private key bytes  (32 bytes)
  pkNetBytes[pkNetBytesLen - 1] = 1;    // Leading digit      (1 byte)

  // Double SHA-256 hash
  const shaObj = new jsSHA(0, 0, { "numRounds": 2 });
  shaObj.update(pkNetBytes);

  // WIF Checksum
  const checksum = shaObj.getHash(0).slice(0, 4);
  const keyWithChecksum = new Uint8Array(pkNetBytesLen + checksum.length);
  writeToUint8(keyWithChecksum, pkNetBytes, 0);
  writeToUint8(keyWithChecksum, checksum, pkNetBytesLen);

  // Return both the raw bytes and the WIF format
  return { pkBytes, strWIF: to_b58(keyWithChecksum) };
}

// Derive a Secp256k1 network-encoded public key (coin address) from raw private key bytes
deriveAddress = function (pkBytes) {
  // Public Key Derivation
  let nPubkey = Crypto.util.bytesToHex(nSecp256k1.getPublicKey(pkBytes)).substr(2);
  const pubY = Secp256k1.uint256(nPubkey.substr(64), 16);
  nPubkey = nPubkey.substr(0, 64);
  const publicKeyBytesCompressed = Crypto.util.hexToBytes(nPubkey);
  publicKeyBytesCompressed.unshift(pubY.isEven() ? 2 : 3);

  // First pubkey SHA-256 hash
  const pubKeyHashing = new jsSHA(0, 0, { "numRounds": 1 });
  pubKeyHashing.update(publicKeyBytesCompressed);

  // RIPEMD160 hash
  const pubKeyHashRipemd160 = ripemd160(pubKeyHashing.getHash(0));

  // Network Encoding
  const pubKeyHashNetwork = new Uint8Array(pubKeyHashNetworkLen);
  pubKeyHashNetwork[0] = PUBKEY_ADDRESS;
  writeToUint8(pubKeyHashNetwork, pubKeyHashRipemd160, 1);

  // Double SHA-256 hash
  const pubKeyHashingS = new jsSHA(0, 0, { "numRounds": 2 });
  pubKeyHashingS.update(pubKeyHashNetwork);
  const pubKeyHashingSF = pubKeyHashingS.getHash(0);

  // Checksum
  const checksumPubKey = pubKeyHashingSF.slice(0, 4);

  // Public key pre-base58
  const pubKeyPreBase = new Uint8Array(pubPrebaseLen);
  writeToUint8(pubKeyPreBase, pubKeyHashNetwork, 0);
  writeToUint8(pubKeyPreBase, checksumPubKey, pubKeyHashNetworkLen);

  // Encode as Base58 human-readable network address
  return to_b58(pubKeyPreBase);
}

// Wallet Import
importWallet = function (newWif = false, fRaw = false) {
  const strImportConfirm = "Do you really want to import a new address? If you haven't saved the last private key, the wallet will be LOST forever.";
  const walletConfirm = fWalletLoaded ? window.confirm(strImportConfirm) : true;
  if (walletConfirm) {
    // If raw bytes: purely encode the given bytes rather than generating our own bytes
    if (fRaw) {
      newWif = generateOrEncodePrivkey(newWif).strWIF;

      // A raw import likely means non-user owned key (i.e: created via VanityGen), thus, we assume safety first and add an exit blocking listener
      addEventListener("beforeunload", beforeUnloadListener, {capture: true});
    }

    // Select WIF from internal source OR user input
    privateKeyForTransactions = newWif || domPrivKey.value;
    domPrivKey.value = "";

    // Public Key Derivation
    try {
      // Incase of an invalid/malformed/incompatible private key: catch and display a nice error!
      const bArrConvert = from_b58(privateKeyForTransactions);
      const bArrDropFour = bArrConvert.slice(0, bArrConvert.length - 4);
      const bKey = bArrDropFour.slice(1, bArrDropFour.length);

      // Extract raw bytes and derive the key from them
      const pkBytes = bKey.slice(0, bKey.length - 1);
      publicKeyForNetwork = deriveAddress(pkBytes);
    } catch (e) {
      return createAlert('warning', '<b>Failed to import!</b> Invalid private key.' +
                                    '<br>Double-check where your key came from!',
                                    6000);
    }
    
    // Reaching here: the deserialisation was a full cryptographic success, so a wallet is now imported!
    fWalletLoaded = true;

    // Display Text 
    domGuiWallet.style.display = 'block';
    domPrivateTxt.value = privateKeyForTransactions;
    keyTxt.value = privateKeyForTransactions;
    domGuiAddress.innerHTML = publicKeyForNetwork;

    // Private Key QR
    createQR(privateKeyForTransactions, domPrivateQr);
    createQR(privateKeyForTransactions, keyQR);

    // Address QR
    createQR('freedomcoin:' + publicKeyForNetwork, domPublicQr);

    // Address Modal QR
    createQR('freedomcoin:' + publicKeyForNetwork, domModalQR);
    domModalQrLabel.innerHTML = 'freedomcoin:' + publicKeyForNetwork;
    domModalQR.firstChild.style.width = "100%";
    domModalQR.firstChild.style.height = "auto";
    domModalQR.firstChild.style.imageRendering = "crisp-edges";

    // Set the address clipboard value
    document.getElementById('clipboard').value = publicKeyForNetwork;

    // Set view key as public
    viewPrivKey = true;
    toggleKeyView();

    // Hide the encryption warning if the user pasted the private key
    if (!newWif) $([qrModal, domGenKeyWarning]).fadeToggle(500);

    // Load UTXOs from explorer
   // if (networkEnabled) getUTXOs();
    
    // Hide all wallet starter options
    hideAllWalletOptions();
  }
}

// Wallet Generation
generateWallet = async function (noUI = false) {
  const strImportConfirm = "Do you really want to import a new address? If you haven't saved the last private key, the wallet will be LOST forever.";
  const walletConfirm = fWalletLoaded && !noUI ? window.confirm(strImportConfirm) : true;
  if (walletConfirm) {
    // Private Key Generation
    const cPriv = generateOrEncodePrivkey();
    privateKeyForTransactions = cPriv.strWIF;

    // Public Key Derivation
    publicKeyForNetwork = deriveAddress(cPriv.pkBytes);
    fWalletLoaded = true;

    if (!noUI) {
      // Display Text
      $([qrModal, domGenKeyWarning]).fadeToggle(500);
      domPrivateTxt.value = privateKeyForTransactions;
      keyTxt.value = privateKeyForTransactions;
      domGuiAddress.innerHTML = publicKeyForNetwork;

      // Private Key QR
      createQR(privateKeyForTransactions, domPrivateQr);
      createQR(privateKeyForTransactions, keyQR);

      // Address QR
      createQR('freedomcoin:' + publicKeyForNetwork, domPublicQr);

      // Address Modal QR
      createQR('freedomcoin:' + publicKeyForNetwork, domModalQR);
      domModalQrLabel.innerHTML = 'freedomcoin:' + publicKeyForNetwork;
      domModalQR.firstChild.style.width = "100%";
      domModalQR.firstChild.style.height = "auto";
      domModalQR.firstChild.style.imageRendering = "crisp-edges";

      // Set the address clipboard value
      document.getElementById('clipboard').value = publicKeyForNetwork;


      // Display the dashboard
      domGuiWallet.style.display = 'block';
      viewPrivKey = false;
      hideAllWalletOptions();

      // Refresh the balance UI (why? because it'll also display any 'get some funds!' alerts)
      getBalance(true);
      getStakingBalance(true);
      
      // Add a listener to block page unloads until we are sure the user has saved their keys, safety first!
      addEventListener("beforeunload", beforeUnloadListener, {capture: true});
    }

    // Return the keypair
    return { 'pubkey': publicKeyForNetwork, 'privkey': privateKeyForTransactions };
  }
}

async function benchmark(quantity) {
  let i = 0;
  const nStartTime = Date.now();
  while (i < quantity) {
    await generateWallet(true);
    i++;
  }
  const nEndTime = Date.now();
  console.log("Time taken to generate " + i + " addresses: " + (nEndTime - nStartTime).toFixed(2) + 'ms');
}

encryptWallet = async function (strPassword = '') {
  // Encrypt the wallet WIF with AES-GCM and a user-chosen password - suitable for browser storage
  let strEncWIF = await encrypt(privateKeyForTransactions, strPassword);
  if (!strEncWIF) return false;

  // Set the encrypted wallet in localStorage
  localStorage.setItem("encwif", strEncWIF);

  // Hide the encryption warning
  domGenKeyWarning.style.display = 'none';

  // Remove the exit blocker, we can annoy the user less knowing the key is safe in their localstorage!
  removeEventListener("beforeunload", beforeUnloadListener, {capture: true});
}

decryptWallet = async function (strPassword = '') {
  // Check if there's any encrypted WIF available
  const strEncWIF = localStorage.getItem("encwif");
  if (!strEncWIF || strEncWIF.length < 1) return false;

  // Prompt to decrypt it via password
  const strDecWIF = await decrypt(strEncWIF, strPassword);
  if (!strDecWIF || strDecWIF === "decryption failed!") {
    if (strDecWIF) return alert("Incorrect password!");
  } else {
    importWallet(strDecWIF);
    return true;
  }
}

hasEncryptedWallet = function () {
  return localStorage.getItem("encwif") ? true : false;
}

hasWalletUnlocked = function (fIncludeNetwork = false) {
  if (fIncludeNetwork && !networkEnabled)
    return createAlert('warning', "<b>Offline Mode is active!</b><br>Please disable Offline Mode for automatic transactions", 5500);
  if (!publicKeyForNetwork) {
      return createAlert('warning', "Please " + (hasEncryptedWallet() ? "unlock " : "import/create") + " your wallet before sending transactions!", 3500);
  } else {
    return true;
  }
}
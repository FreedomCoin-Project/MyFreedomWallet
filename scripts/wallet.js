'use strict';

// Generate a new private key OR encode an existing private key from raw bytes
const generateOrEncodePrivkey = (pkBytesToEncode) => {
    const pkBytes = pkBytesToEncode || getSafeRand();
    const pkNetBytes = new Uint8Array(pkBytes.length + 2);

    // Network Encoding
    pkNetBytes[0] = SECRET_KEY;
    writeToUint8(pkNetBytes, pkBytes, 1);
    pkNetBytes[pkNetBytes.length - 1] = 1;

    // Double SHA-256 hash
    const shaObj = new jsSHA(0, 0, { numRounds: 2 });
    shaObj.update(pkNetBytes);
    const checksum = shaObj.getHash(0).slice(0, 4);

    // Combine and return key
    const keyWithChecksum = new Uint8Array(pkNetBytes.length + checksum.length);
    writeToUint8(keyWithChecksum, pkNetBytes, 0);
    writeToUint8(keyWithChecksum, checksum, pkNetBytes.length);

    return { pkBytes, strWIF: to_b58(keyWithChecksum) };
};

// Derive a Secp256k1 public key (coin address) from raw private key bytes
const deriveAddress = (pkBytes) => {
    let nPubkey = Crypto.util.bytesToHex(nSecp256k1.getPublicKey(pkBytes)).substr(2);
    const pubY = Secp256k1.uint256(nPubkey.substr(64), 16);
    nPubkey = nPubkey.substr(0, 64);
    
    const publicKeyBytesCompressed = Crypto.util.hexToBytes(nPubkey);
    publicKeyBytesCompressed.unshift(pubY.isEven() ? 2 : 3);

    // SHA-256 hash
    const pubKeyHashing = new jsSHA(0, 0, { numRounds: 1 });
    pubKeyHashing.update(publicKeyBytesCompressed);
    
    // RIPEMD160 hash
    const pubKeyHashRipemd160 = ripemd160(pubKeyHashing.getHash(0));

    // Network Encoding
    const pubKeyHashNetwork = new Uint8Array(pubKeyHashNetworkLen);
    pubKeyHashNetwork[0] = PUBKEY_ADDRESS;
    writeToUint8(pubKeyHashNetwork, pubKeyHashRipemd160, 1);

    // Double SHA-256 hash
    const pubKeyHashingS = new jsSHA(0, 0, { numRounds: 2 });
    pubKeyHashingS.update(pubKeyHashNetwork);
    const checksumPubKey = pubKeyHashingS.getHash(0).slice(0, 4);

    // Public key pre-base58
    const pubKeyPreBase = new Uint8Array(pubPrebaseLen);
    writeToUint8(pubKeyPreBase, pubKeyHashNetwork, 0);
    writeToUint8(pubKeyPreBase, checksumPubKey, pubKeyHashNetworkLen);

    return to_b58(pubKeyPreBase);
};

// Wallet Import
const importWallet = (newWif = false, fRaw = false) => {
    if (fWalletLoaded && !window.confirm("Do you really want to import a new address? If you haven't saved the last private key, the wallet will be LOST forever.")) {
        return;
    }

    if (fRaw) {
        newWif = generateOrEncodePrivkey(newWif).strWIF;
        addEventListener("beforeunload", beforeUnloadListener, { capture: true });
    }

    try {
        privateKeyForTransactions = newWif || domPrivKey.value;
        domPrivKey.value = "";

        const bArrConvert = from_b58(privateKeyForTransactions);
        const pkBytes = bArrConvert.slice(1, bArrConvert.length - 5);

        publicKeyForNetwork = deriveAddress(pkBytes);
    } catch (e) {
        return createAlert('warning', '<b>Failed to import!</b> Invalid private key.<br>Double-check where your key came from!', 6000);
    }

    fWalletLoaded = true;
    updateWalletUI();
    if (networkEnabled) getUTXOs();
};

// Wallet Generation
const generateWallet = async (noUI = false) => {
    if (fWalletLoaded && !noUI && !window.confirm("Do you really want to import a new address? If you haven't saved the last private key, the wallet will be LOST forever.")) {
        return;
    }

    const cPriv = generateOrEncodePrivkey();
    privateKeyForTransactions = cPriv.strWIF;
    publicKeyForNetwork = deriveAddress(cPriv.pkBytes);
    fWalletLoaded = true;

    if (!noUI) {
        updateWalletUI();
        getBalance(true);
        getStakingBalance(true);
        addEventListener("beforeunload", beforeUnloadListener, { capture: true });
    }

    return { pubkey: publicKeyForNetwork, privkey: privateKeyForTransactions };
};

// Benchmark Wallet Generation
const benchmark = async (quantity) => {
    const startTime = Date.now();
    for (let i = 0; i < quantity; i++) {
        await generateWallet(true);
    }
    console.log(`Time taken to generate ${quantity} addresses: ${(Date.now() - startTime).toFixed(2)}ms`);
};

// Encrypt Wallet
const encryptWallet = async (password = '') => {
    const encryptedWIF = await encrypt(privateKeyForTransactions, password);
    if (!encryptedWIF) return false;

    localStorage.setItem("encwif", encryptedWIF);
    domGenKeyWarning.style.display = 'none';
    removeEventListener("beforeunload", beforeUnloadListener, { capture: true });
};

// Decrypt Wallet
const decryptWallet = async (password = '') => {
    const encryptedWIF = localStorage.getItem("encwif");
    if (!encryptedWIF) return false;

    const decryptedWIF = await decrypt(encryptedWIF, password);
    if (!decryptedWIF || decryptedWIF === "decryption failed!") {
        return alert("Incorrect password!");
    }

    importWallet(decryptedWIF);
    return true;
};

// Check if an encrypted wallet exists
const hasEncryptedWallet = () => !!localStorage.getItem("encwif");

// Check if a wallet is unlocked
const hasWalletUnlocked = (includeNetwork = false) => {
    if (includeNetwork && !networkEnabled) {
        return createAlert('warning', "<b>Offline Mode is active!</b><br>Please disable Offline Mode for automatic transactions", 5500);
    }

    if (!publicKeyForNetwork) {
        return createAlert('warning', `Please ${hasEncryptedWallet() ? "unlock" : "import/create"} your wallet before sending transactions!`, 3500);
    }

    return true;
};

// Update Wallet UI
const updateWalletUI = () => {
    domGuiWallet.style.display = 'block';
    domPrivateTxt.value = privateKeyForTransactions;
    keyTxt.value = privateKeyForTransactions;
    domGuiAddress.innerHTML = publicKeyForNetwork;

    createQR(privateKeyForTransactions, domPrivateQr);
    createQR(privateKeyForTransactions, keyQR);
    createQR(`freedomcoin:${publicKeyForNetwork}`, domPublicQr);
    createQR(`freedomcoin:${publicKeyForNetwork}`, domModalQR);
    
    domModalQrLabel.innerHTML = `freedomcoin:${publicKeyForNetwork}`;
    domModalQR.firstChild.style.width = "100%";
    domModalQR.firstChild.style.height = "auto";
    domModalQR.firstChild.style.imageRendering = "crisp-edges";

    document.getElementById('clipboard').value = publicKeyForNetwork;
    hideAllWalletOptions();
};

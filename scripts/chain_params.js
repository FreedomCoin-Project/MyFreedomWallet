// In most BTC-derived coins, the below parameters can be found in the 'src/chainparams.cpp' Mainnet configuration.
// These below params share the same names as the CPP params, so finding and editing these is easy-peasy!
// <[network_byte] [32_byte_payload] [0x01] [4_byte_checksum]>
export const PRIVKEY_BYTE_LENGTH = 38;

export const COIN_DECIMALS = 8;
export const COIN = 10 ** 8;

/** The maximum gap (absence of transactions within a range of derived addresses) before an account search ends */
export const MAX_ACCOUNT_GAP = 20;

/* Internal tweaking parameters */
// A new encryption password must be 'at least' this long.
export const MIN_PASS_LENGTH = 6;

/* chainparams */
export const cChainParams = {
    current: null,
    main: {
        collateralInSats: 5000 * COIN,
        isTestnet: false,
        TICKER: 'FREED',
        PUBKEY_PREFIX: ['T'],
        STAKING_PREFIX: 't',
        PUBKEY_ADDRESS: 66,
        SECRET_KEY: 156,
        BIP44_TYPE: 119,
        BIP44_TYPE_LEDGER: 77,
        PROTOCOL_VERSION: 72002,
        MASTERNODE_PORT: 15110,
        // A list of Labs-trusted explorers
        Explorers: [
            // Display name      Blockbook-compatible API base
            { name: 'freedom', url: 'https://chain.freedomcoin.global' },
        ],
        Nodes: [{ name: 'duddino', url: 'https://rpc.freedomcoin.global/mainnet' }],
        Consensus: {
            // Network upgrades
            UPGRADE_V6_0: 500000,
        },
    },
    testnet: {
        collateralInSats: 10000 * COIN,
        isTestnet: true,
        TICKER: 'tPIV',
        PUBKEY_PREFIX: ['x', 'y'],
        STAKING_PREFIX: 'W',
        PUBKEY_ADDRESS: 139,
        SECRET_KEY: 239,
        BIP44_TYPE: 1,
        BIP44_TYPE_LEDGER: 1,
        PROTOCOL_VERSION: 70926,
        MASTERNODE_PORT: 51474,
        // A list of Labs-trusted explorers
        Explorers: [
            // Display name      Blockbook-compatible API base
            { name: 'rockdev', url: 'https://testnet.rockdev.org' },
        ],
        Nodes: [{ name: 'duddino', url: 'https://rpc.duddino.com/testnet' }],
        Consensus: {
            // Network upgrades
            UPGRADE_V6_0: undefined,
        },
    },
};
// Set default chain
cChainParams.current = cChainParams.main;

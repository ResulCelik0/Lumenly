import { Networks } from "@stellar/stellar-sdk";

/**
 * Central place for all Stellar Testnet configuration.
 * Everything in this app is hard-wired to Testnet on purpose — this is a
 * learning dApp and must never touch mainnet funds.
 */
export const NETWORK = {
  label: "Testnet",
  passphrase: Networks.TESTNET, // "Test SDF Network ; September 2015"
  horizonUrl: "https://horizon-testnet.stellar.org",
  friendbotUrl: "https://friendbot.stellar.org",
  explorerTxUrl: (hash: string) =>
    `https://stellar.expert/explorer/testnet/tx/${hash}`,
  explorerAccountUrl: (account: string) =>
    `https://stellar.expert/explorer/testnet/account/${account}`,
} as const;

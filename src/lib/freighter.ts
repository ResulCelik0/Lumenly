import {
  getAddress,
  getNetworkDetails,
  isAllowed,
  isConnected,
  requestAccess,
  setAllowed,
  signTransaction,
} from "@stellar/freighter-api";
import { NETWORK } from "./network";

/** True when the Freighter browser extension is installed and reachable. */
export async function isFreighterInstalled(): Promise<boolean> {
  try {
    const { isConnected: connected } = await isConnected();
    return connected;
  } catch {
    return false;
  }
}

/**
 * Prompt the user to connect (authorise this app) and return their public key.
 * Throws a human-readable error if the user rejects or the extension is missing.
 */
export async function connectWallet(): Promise<string> {
  if (!(await isFreighterInstalled())) {
    throw new Error(
      "Freighter was not detected. Install it from freighter.app and refresh.",
    );
  }

  const allowed = await isAllowed();
  if (!allowed.isAllowed) {
    await setAllowed();
  }

  const access = await requestAccess();
  if (access.error) {
    throw new Error(access.error.message ?? "Connection request was rejected.");
  }
  if (!access.address) {
    throw new Error("Could not read a public key from Freighter.");
  }
  return access.address;
}

/**
 * Return the already-authorised public key without prompting, or null if the
 * app is not yet connected. Used to restore the session on page load.
 */
export async function getConnectedAddress(): Promise<string | null> {
  try {
    if (!(await isFreighterInstalled())) return null;
    const allowed = await isAllowed();
    if (!allowed.isAllowed) return null;
    const { address, error } = await getAddress();
    if (error || !address) return null;
    return address;
  } catch {
    return null;
  }
}

export interface NetworkInfo {
  network: string;
  networkPassphrase: string;
  isTestnet: boolean;
}

/** Read which network Freighter is currently pointed at. */
export async function getNetworkInfo(): Promise<NetworkInfo | null> {
  try {
    const details = await getNetworkDetails();
    if (details.error) return null;
    return {
      network: details.network,
      networkPassphrase: details.networkPassphrase,
      isTestnet: details.networkPassphrase === NETWORK.passphrase,
    };
  } catch {
    return null;
  }
}

/**
 * Hand an unsigned transaction XDR to Freighter for signing.
 * Returns the signed XDR ready to submit to Horizon.
 */
export async function signWithFreighter(
  xdr: string,
  address: string,
): Promise<string> {
  const result = await signTransaction(xdr, {
    networkPassphrase: NETWORK.passphrase,
    address,
  });
  if (result.error) {
    throw new Error(result.error.message ?? "Signing was rejected in Freighter.");
  }
  return result.signedTxXdr;
}

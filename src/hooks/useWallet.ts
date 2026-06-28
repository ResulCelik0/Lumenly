import { useCallback, useEffect, useState } from "react";
import {
  connectWallet,
  getConnectedAddress,
  getNetworkInfo,
  type NetworkInfo,
} from "../lib/freighter";
import { AccountNotFoundError, fetchXlmBalance } from "../lib/stellar";

export type BalanceState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; xlm: string }
  | { status: "unfunded" }
  | { status: "error"; message: string };

export interface WalletState {
  address: string | null;
  network: NetworkInfo | null;
  connecting: boolean;
  error: string | null;
  balance: BalanceState;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<BalanceState>({ status: "idle" });

  const loadBalance = useCallback(async (publicKey: string) => {
    setBalance({ status: "loading" });
    try {
      const xlm = await fetchXlmBalance(publicKey);
      setBalance({ status: "loaded", xlm });
    } catch (err) {
      if (err instanceof AccountNotFoundError) {
        setBalance({ status: "unfunded" });
      } else {
        setBalance({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load balance.",
        });
      }
    }
  }, []);

  const applyConnection = useCallback(
    async (publicKey: string) => {
      setAddress(publicKey);
      setNetwork(await getNetworkInfo());
      await loadBalance(publicKey);
    },
    [loadBalance],
  );

  // Restore an existing authorisation on first load (no popup).
  useEffect(() => {
    let active = true;
    (async () => {
      const existing = await getConnectedAddress();
      if (active && existing) {
        await applyConnection(existing);
      }
    })();
    return () => {
      active = false;
    };
  }, [applyConnection]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const publicKey = await connectWallet();
      await applyConnection(publicKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet.");
    } finally {
      setConnecting(false);
    }
  }, [applyConnection]);

  const disconnect = useCallback(() => {
    // Freighter has no programmatic "revoke"; we clear local app state so the
    // user is logged out of this dApp. Reconnecting will not re-prompt unless
    // they removed the app inside the extension.
    setAddress(null);
    setNetwork(null);
    setBalance({ status: "idle" });
    setError(null);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (address) await loadBalance(address);
  }, [address, loadBalance]);

  return {
    address,
    network,
    connecting,
    error,
    balance,
    connect,
    disconnect,
    refreshBalance,
  };
}

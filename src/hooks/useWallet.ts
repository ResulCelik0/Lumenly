import { useCallback, useEffect, useState } from "react";
import {
  connectWallet,
  getConnectedAddress,
  getNetworkInfo,
  type NetworkInfo,
} from "../lib/freighter";
import { AccountNotFoundError, fetchXlmBalance } from "../lib/stellar";

/**
 * Persisted connection session — the single source of truth for "is this dApp
 * connected". This is the standard wallet-kit / wagmi pattern: we remember the
 * connection the user explicitly established and only auto-restore when such a
 * record exists.
 *
 * Freighter has no programmatic "revoke", so we cannot rely on the extension's
 * own "allowed" state to decide connection — a user who connected once would
 * otherwise be reconnected forever. Gating on our own record is what makes
 * Disconnect stick across refreshes. The stored value is a PUBLIC key only
 * (no secret material).
 */
export const SESSION_KEY = "lumenly:session";

interface WalletSession {
  address: string;
}

const loadSession = (): WalletSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WalletSession;
    return parsed?.address ? parsed : null;
  } catch {
    return null;
  }
};

const saveSession = (session: WalletSession): void => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable (private mode) — best effort only */
  }
};

const clearSession = (): void => {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
};

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

  // Restore on load ONLY when we have a persisted session record. We then
  // confirm with Freighter that the account is still authorised and unchanged;
  // a stale record (e.g. user revoked the app in the extension) is discarded.
  useEffect(() => {
    let active = true;
    (async () => {
      const session = loadSession();
      if (!session) return;
      try {
        const live = await getConnectedAddress();
        if (!active) return;
        if (live && live === session.address) {
          await applyConnection(live);
        } else {
          clearSession();
        }
      } catch {
        /* never let session restore crash the app */
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
      // Persist the established connection — this record is what makes the
      // session survive a refresh.
      saveSession({ address: publicKey });
      await applyConnection(publicKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet.");
    } finally {
      setConnecting(false);
    }
  }, [applyConnection]);

  const disconnect = useCallback(() => {
    // Remove the session record (single source of truth) and clear app state.
    // Freighter has no programmatic revoke, so gating restore on this record is
    // what prevents a silent reconnect after refresh.
    clearSession();
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

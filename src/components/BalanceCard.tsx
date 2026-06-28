import { useState } from "react";
import type { BalanceState } from "../hooks/useWallet";
import { fundWithFriendbot } from "../lib/stellar";
import { formatXlm, truncateMiddle } from "../lib/format";
import { NETWORK } from "../lib/network";

interface Props {
  address: string;
  balance: BalanceState;
  onRefresh: () => Promise<void>;
}

export function BalanceCard({ address, balance, onRefresh }: Props) {
  const [funding, setFunding] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleFund() {
    setFunding(true);
    setFundError(null);
    try {
      await fundWithFriendbot(address);
      await onRefresh();
    } catch (err) {
      setFundError(err instanceof Error ? err.message : "Funding failed.");
    } finally {
      setFunding(false);
    }
  }

  async function copyAddress() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="card balance-card">
      <header className="card__head">
        <h2>Balance</h2>
        <button
          className="btn btn--ghost btn--sm"
          onClick={onRefresh}
          disabled={balance.status === "loading"}
        >
          {balance.status === "loading" ? "Refreshing…" : "↻ Refresh"}
        </button>
      </header>

      <button className="address-pill" onClick={copyAddress} title="Copy address">
        <span className="dot" />
        {truncateMiddle(address, 8, 8)}
        <span className="address-pill__copy">{copied ? "Copied!" : "Copy"}</span>
      </button>

      <div className="balance-value" data-testid="balance">
        {balance.status === "loaded" && (
          <>
            <span className="balance-value__num">{formatXlm(balance.xlm)}</span>
            <span className="balance-value__unit">XLM</span>
          </>
        )}
        {balance.status === "loading" && (
          <span className="balance-value__muted">Loading balance…</span>
        )}
        {balance.status === "idle" && (
          <span className="balance-value__muted">—</span>
        )}
        {balance.status === "unfunded" && (
          <span className="balance-value__muted">Account not funded yet</span>
        )}
        {balance.status === "error" && (
          <span className="balance-value__error">{balance.message}</span>
        )}
      </div>

      {balance.status === "unfunded" && (
        <div className="hint">
          <p>
            This account doesn&apos;t exist on the ledger yet. Fund it with the
            testnet Friendbot to get 10,000 free XLM.
          </p>
          <button className="btn btn--primary" onClick={handleFund} disabled={funding}>
            {funding ? "Funding…" : "Fund with Friendbot"}
          </button>
          {fundError && <p className="text-error">{fundError}</p>}
        </div>
      )}

      <a
        className="link-out"
        href={NETWORK.explorerAccountUrl(address)}
        target="_blank"
        rel="noreferrer"
      >
        View account on Stellar Expert ↗
      </a>
    </section>
  );
}

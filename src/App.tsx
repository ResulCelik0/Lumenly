import { useWallet } from "./hooks/useWallet";
import { ConnectPanel } from "./components/ConnectPanel";
import { BalanceCard } from "./components/BalanceCard";
import { SendForm } from "./components/SendForm";
import { truncateMiddle } from "./lib/format";

export default function App() {
  const wallet = useWallet();
  const connected = wallet.address !== null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/stellar.svg" alt="" width={28} height={28} />
          <span>Stellar Pay</span>
          <span className="badge badge--net">Testnet</span>
        </div>

        {connected && (
          <div className="topbar__wallet">
            {wallet.network && !wallet.network.isTestnet && (
              <span className="badge badge--warn" title="Switch Freighter to Testnet">
                ⚠ Freighter is on {wallet.network.network}
              </span>
            )}
            <span className="wallet-chip" title={wallet.address ?? ""}>
              <span className="dot" />
              {truncateMiddle(wallet.address!, 5, 5)}
            </span>
            <button className="btn btn--ghost btn--sm" onClick={wallet.disconnect}>
              Disconnect
            </button>
          </div>
        )}
      </header>

      <main className="main">
        <div className="hero">
          <h1>Send XLM on the Stellar Testnet</h1>
          <p className="muted">
            A minimal payment dApp: connect Freighter, check your balance, and
            send a transaction — with live success / failure feedback.
          </p>
        </div>

        {!connected ? (
          <ConnectPanel
            connecting={wallet.connecting}
            error={wallet.error}
            onConnect={wallet.connect}
          />
        ) : (
          <div className="grid">
            <BalanceCard
              address={wallet.address!}
              balance={wallet.balance}
              onRefresh={wallet.refreshBalance}
            />
            <SendForm address={wallet.address!} onSent={wallet.refreshBalance} />
          </div>
        )}
      </main>

      <footer className="footer">
        <span>Built on Stellar · Testnet only</span>
        <a href="https://developers.stellar.org/" target="_blank" rel="noreferrer">
          Stellar Docs ↗
        </a>
      </footer>
    </div>
  );
}

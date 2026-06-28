interface Props {
  connecting: boolean;
  error: string | null;
  onConnect: () => void;
}

/** Landing state shown before a wallet is connected. */
export function ConnectPanel({ connecting, error, onConnect }: Props) {
  return (
    <section className="card connect-card">
      <div className="connect-card__art" aria-hidden>
        🚀
      </div>
      <h2>Connect your wallet to begin</h2>
      <p className="muted">
        This dApp runs entirely on the <b>Stellar Testnet</b>. Connect the
        Freighter browser extension to view your balance and send test XLM. No
        real funds are involved.
      </p>

      <button className="btn btn--primary btn--block" onClick={onConnect} disabled={connecting}>
        {connecting && <span className="spinner" aria-hidden />}
        {connecting ? "Connecting…" : "Connect Freighter"}
      </button>

      {error && (
        <div className="feedback feedback--error" role="alert">
          <div className="feedback__icon">✕</div>
          <div className="feedback__body">
            <strong>Couldn&apos;t connect</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      <p className="muted small">
        Don&apos;t have it?{" "}
        <a href="https://www.freighter.app/" target="_blank" rel="noreferrer">
          Install Freighter ↗
        </a>
      </p>
    </section>
  );
}

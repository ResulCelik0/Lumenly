import { formatXlm, truncateMiddle } from "../lib/format";
import { NETWORK } from "../lib/network";

export type TxResult =
  | {
      status: "success";
      hash: string;
      amount: string;
      destination: string;
    }
  | { status: "error"; message: string };

interface Props {
  result: TxResult | null;
}

/** Renders the success / failure state of the most recent transaction. */
export function TxFeedback({ result }: Props) {
  if (!result) return null;

  if (result.status === "error") {
    return (
      <div className="feedback feedback--error" role="alert">
        <div className="feedback__icon">✕</div>
        <div className="feedback__body">
          <strong>Transaction failed</strong>
          <p>{result.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback feedback--success" role="status">
      <div className="feedback__icon">✓</div>
      <div className="feedback__body">
        <strong>Payment sent successfully</strong>
        <p>
          Sent <b>{formatXlm(result.amount)} XLM</b> to{" "}
          <code>{truncateMiddle(result.destination, 6, 6)}</code>
        </p>
        <dl className="feedback__hash">
          <dt>Transaction hash</dt>
          <dd>
            <code>{truncateMiddle(result.hash, 10, 10)}</code>
          </dd>
        </dl>
        <a
          className="btn btn--ghost btn--sm"
          href={NETWORK.explorerTxUrl(result.hash)}
          target="_blank"
          rel="noreferrer"
        >
          View on Stellar Expert ↗
        </a>
      </div>
    </div>
  );
}

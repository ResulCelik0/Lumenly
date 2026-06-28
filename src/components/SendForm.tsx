import { useState } from "react";
import { signWithFreighter } from "../lib/freighter";
import {
  buildPaymentXdr,
  isValidPublicKey,
  submitSignedTransaction,
} from "../lib/stellar";
import { TxFeedback, type TxResult } from "./TxFeedback";

interface Props {
  address: string;
  /** Refresh the balance after a confirmed payment. */
  onSent: () => Promise<void>;
}

type Phase = "idle" | "building" | "signing" | "submitting";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "Send XLM",
  building: "Preparing transaction…",
  signing: "Waiting for Freighter…",
  submitting: "Submitting to network…",
};

export function SendForm({ address, onSent }: Props) {
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<TxResult | null>(null);

  const busy = phase !== "idle";

  const destinationValid = destination.trim() === "" || isValidPublicKey(destination);
  const amountNum = Number(amount);
  const amountValid = amount.trim() === "" || (amountNum > 0 && Number.isFinite(amountNum));

  const canSubmit =
    !busy &&
    isValidPublicKey(destination) &&
    amountNum > 0 &&
    destination.trim() !== address; // can't pay yourself meaningfully

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    try {
      setPhase("building");
      const xdr = await buildPaymentXdr({
        source: address,
        destination: destination.trim(),
        amount: amount.trim(),
        memo,
      });

      setPhase("signing");
      const signedXdr = await signWithFreighter(xdr, address);

      setPhase("submitting");
      const hash = await submitSignedTransaction(signedXdr);

      setResult({
        status: "success",
        hash,
        amount: amount.trim(),
        destination: destination.trim(),
      });
      setDestination("");
      setAmount("");
      setMemo("");
      await onSent();
    } catch (err) {
      setResult({
        status: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setPhase("idle");
    }
  }

  return (
    <section className="card">
      <header className="card__head">
        <h2>Send a payment</h2>
        <span className="badge badge--soft">Testnet XLM</span>
      </header>

      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Destination address</span>
          <input
            className={`input ${!destinationValid ? "input--invalid" : ""}`}
            placeholder="G… recipient public key"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          {!destinationValid && (
            <span className="field__error">Not a valid Stellar public key.</span>
          )}
          {destination.trim() === address && destination !== "" && (
            <span className="field__error">
              That&apos;s your own address — pick a different recipient.
            </span>
          )}
        </label>

        <label className="field">
          <span className="field__label">Amount (XLM)</span>
          <input
            className={`input ${!amountValid ? "input--invalid" : ""}`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.0000001"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {!amountValid && (
            <span className="field__error">Enter an amount greater than 0.</span>
          )}
        </label>

        <label className="field">
          <span className="field__label">
            Memo <span className="field__optional">(optional)</span>
          </span>
          <input
            className="input"
            placeholder="e.g. coffee ☕"
            value={memo}
            maxLength={28}
            onChange={(e) => setMemo(e.target.value)}
          />
        </label>

        <button className="btn btn--primary btn--block" type="submit" disabled={!canSubmit}>
          {busy && <span className="spinner" aria-hidden />}
          {PHASE_LABEL[phase]}
        </button>
      </form>

      <TxFeedback result={result} />
    </section>
  );
}

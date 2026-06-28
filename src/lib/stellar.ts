import {
  Asset,
  BASE_FEE,
  Horizon,
  Memo,
  Operation,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { NETWORK } from "./network";

const server = new Horizon.Server(NETWORK.horizonUrl);

/** Thrown when the account does not exist on the ledger yet (needs funding). */
export class AccountNotFoundError extends Error {
  constructor(publicKey: string) {
    super(`Account ${publicKey} is not funded on the Stellar testnet yet.`);
    this.name = "AccountNotFoundError";
  }
}

/** Returns true when a string is a valid Stellar public key (G...). */
export function isValidPublicKey(value: string): boolean {
  return StrKey.isValidEd25519PublicKey(value.trim());
}

/**
 * Fetch the native (XLM) balance for an account.
 * Returns the balance as a string (e.g. "9999.9999900").
 * Throws {@link AccountNotFoundError} when the account is not yet funded.
 */
export async function fetchXlmBalance(publicKey: string): Promise<string> {
  try {
    const account = await server.loadAccount(publicKey);
    const native = account.balances.find(
      (b) => b.asset_type === "native",
    );
    return native ? native.balance : "0";
  } catch (err: unknown) {
    if (isNotFound(err)) {
      throw new AccountNotFoundError(publicKey);
    }
    throw err;
  }
}

/** Ask Friendbot to create + fund a testnet account with 10,000 XLM. */
export async function fundWithFriendbot(publicKey: string): Promise<void> {
  const res = await fetch(
    `${NETWORK.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`,
  );
  if (!res.ok) {
    // Friendbot returns 400 with a detail message if the account already exists.
    const body = await res.json().catch(() => ({}) as Record<string, unknown>);
    const detail =
      (body as { detail?: string }).detail ?? `HTTP ${res.status}`;
    throw new Error(`Friendbot funding failed: ${detail}`);
  }
}

export interface PaymentParams {
  /** Public key of the connected wallet (the source of funds). */
  source: string;
  /** Destination public key (G...). */
  destination: string;
  /** Amount of XLM as a decimal string, e.g. "12.5". */
  amount: string;
  /** Optional short text memo attached to the transaction. */
  memo?: string;
}

/**
 * Build an unsigned XLM payment transaction and return its base64 XDR.
 * The XDR is handed to Freighter for signing, then submitted via
 * {@link submitSignedTransaction}.
 */
export async function buildPaymentXdr({
  source,
  destination,
  amount,
  memo,
}: PaymentParams): Promise<string> {
  let sourceAccount: Horizon.AccountResponse;
  try {
    sourceAccount = await server.loadAccount(source);
  } catch (err: unknown) {
    if (isNotFound(err)) throw new AccountNotFoundError(source);
    throw err;
  }

  const builder = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK.passphrase,
  }).addOperation(
    Operation.payment({
      destination,
      asset: Asset.native(),
      amount,
    }),
  );

  const trimmedMemo = memo?.trim();
  if (trimmedMemo) {
    builder.addMemo(Memo.text(trimmedMemo));
  }

  return builder.setTimeout(180).build().toXDR();
}

/**
 * Submit a Freighter-signed transaction (base64 XDR) to Horizon.
 * Resolves with the transaction hash on success.
 */
export async function submitSignedTransaction(
  signedXdr: string,
): Promise<string> {
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK.passphrase);
  try {
    const result = await server.submitTransaction(tx);
    return result.hash;
  } catch (err: unknown) {
    throw new Error(describeSubmitError(err));
  }
}

// --- internal helpers -------------------------------------------------------

function isNotFound(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 404;
}

/**
 * Horizon returns rich error details under response.data.extras. Surface the
 * most useful part so the user sees *why* a payment failed.
 */
function describeSubmitError(err: unknown): string {
  const extras = (
    err as {
      response?: { data?: { extras?: Record<string, unknown> } };
    }
  )?.response?.data?.extras;

  if (extras?.result_codes) {
    const codes = extras.result_codes as {
      transaction?: string;
      operations?: string[];
    };
    const op = codes.operations?.join(", ");
    const txCode = codes.transaction ?? "unknown";
    const friendly = friendlyResultCode(op || txCode);
    return friendly ?? `Transaction failed (${op || txCode}).`;
  }

  if (err instanceof Error) return err.message;
  return "Transaction submission failed.";
}

function friendlyResultCode(code: string): string | null {
  const map: Record<string, string> = {
    op_underfunded:
      "Insufficient balance to send this amount (remember the ~1 XLM reserve).",
    op_no_destination:
      "The destination account does not exist on testnet. Fund it first.",
    op_low_reserve:
      "The payment would drop the destination below the minimum reserve.",
    tx_insufficient_balance:
      "Insufficient balance to cover the amount and the network fee.",
    tx_bad_seq: "Sequence number was stale — please try again.",
  };
  return map[code] ?? null;
}

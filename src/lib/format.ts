/** Shorten a public key / hash for display: GABC…WXYZ. */
export function truncateMiddle(value: string, lead = 6, tail = 6): string {
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

/** Format an XLM amount with thousands separators and up to 7 decimals. */
export function formatXlm(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  });
}

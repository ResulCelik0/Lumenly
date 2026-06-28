# 🔐 Security Overview & Audit

This document records the security posture of **Stellar Pay**, the controls that
are in place, and the residual risks. It covers both the **application code** and
the **container/serving infrastructure**.

> TL;DR — `npm audit`: **0 vulnerabilities**. No secrets or private keys ever
> touch this app (Freighter signs). The container runs **rootless, read-only,
> with all Linux capabilities dropped**, behind nginx with a strict **CSP** and a
> full set of security headers (verified live).

---

## 1. Threat model

Stellar Pay is a **non-custodial** front-end dApp. The most important security
property is that **it never has access to the user's secret key** — all signing
happens inside the Freighter extension. That removes the highest-impact class of
risk (key theft) from the app itself.

| Asset | Threat | Mitigation |
| --- | --- | --- |
| User's secret key | Theft / exfiltration | App never sees it; Freighter holds & signs. No `localStorage`/`sessionStorage` of any secret. |
| Transaction integrity | Tampered destination/amount | User reviews & approves every tx in Freighter; network passphrase pinned to Testnet. |
| The web page | XSS → malicious tx | Strict CSP (`script-src 'self'`), no `dangerouslySetInnerHTML`, no `eval`, React auto-escaping. |
| The web page | Clickjacking of wallet UI | `frame-ancestors 'none'` + `X-Frame-Options: DENY`. |
| Outbound links | Reverse-tabnabbing | All `target="_blank"` links use `rel="noreferrer"`. |
| Wrong network | Accidental mainnet use | Everything hard-wired to Testnet in `src/lib/network.ts`; UI warns if Freighter is on another network. |
| Container | Privilege escalation / RCE blast radius | Rootless nginx, read-only FS, `no-new-privileges`, `cap_drop: ALL`. |

Out of scope: the security of the Freighter extension itself, the Stellar
testnet/Horizon, and the user's machine.

---

## 2. Application-level audit

### Dependency scan
```bash
npm audit            # → found 0 vulnerabilities
```

### Static review (source grep + manual)

| Check | Result |
| --- | --- |
| Hardcoded secrets / private keys / seeds / API keys | ✅ None |
| `eval` / `new Function` / `document.write` | ✅ None |
| `dangerouslySetInnerHTML` / raw `innerHTML` | ✅ None |
| Secrets in `localStorage` / `sessionStorage` | ✅ Not used at all |
| `target="_blank"` without `rel="noreferrer"` | ✅ All 4 links protected |
| Plain-HTTP endpoints | ✅ All API calls use HTTPS (Horizon + Friendbot) |
| Input validation | ✅ Destination validated via `StrKey.isValidEd25519PublicKey`; amount must be > 0; self-pay blocked |
| Error handling | ✅ Horizon result-codes mapped to friendly messages; unfunded accounts detected |

### Notes
- User-controlled values that reach the DOM (address, tx hash, memo) are rendered
  as **text** through React, which escapes them — no HTML injection surface.
- Explorer URLs are built from a **validated** public key and a Horizon-returned
  hash, then opened with `rel="noreferrer"`.

---

## 3. Infrastructure hardening (Docker + nginx)

### Container
- **Multi-stage build** — Node is only used to compile; the runtime image is a
  minimal nginx that ships *only* static files (no Node, no source, no dev deps).
- **Rootless** — runs as `nginx` (uid 101) via `nginxinc/nginx-unprivileged`,
  listening on `:8080`. Verified: `docker exec stellar-pay id → uid=101(nginx)`.
- **Read-only root filesystem** (`read_only: true`) with writable `tmpfs` only
  where nginx needs it (`/tmp`, `/var/cache/nginx`, `/var/run`).
- **`no-new-privileges:true`** — blocks setuid privilege escalation.
- **`cap_drop: ALL`** — drops every Linux capability.
- **`server_tokens off`** — nginx version is not leaked.
- **Healthcheck** — liveness probe on `/`.
- **Reproducible deps** — `npm ci` against the committed `package-lock.json`.

### Security headers (served by nginx, verified live)

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'`; `connect-src` limited to Horizon + Friendbot; `script-src 'self'`; `frame-ancestors 'none'`; `object-src 'none'`; `upgrade-insecure-requests` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | camera/mic/geo/usb/payment… all `()` (denied) |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (active over HTTPS) |

Verify yourself after `make up`:
```bash
make headers
# or
curl -sI http://localhost:8080 | grep -i 'content-security-policy\|x-frame'
```

> **CSP note:** `connect-src` is intentionally limited to
> `https://horizon-testnet.stellar.org` and `https://friendbot.stellar.org`.
> Freighter communicates via the extension's injected content script (browser
> extension messaging), which is **not** subject to page CSP, so no extra origin
> is required.

---

## 4. Residual risks & recommendations

| Item | Status | Recommendation |
| --- | --- | --- |
| TLS / HTTPS | Not in image | Terminate TLS at a reverse proxy / load balancer in front (HSTS is already sent). For local prod testing, front with Caddy/Traefik. |
| `style-src 'unsafe-inline'` | Present | Needed for bundler-emitted inline styles. Acceptable; tighten with nonces/hashes if you remove all inline styles. |
| Image CVE scanning | Manual | Run `make scan` (Trivy) in CI to catch base-image CVEs over time. |
| Subresource Integrity | N/A | All scripts are first-party (`script-src 'self'`); no third-party CDN scripts to pin. |
| Dependency drift | — | Keep `npm audit` in CI; Dependabot/renovate for updates. |

---

## 5. Reproduce the audit

```bash
make audit     # npm dependency audit
make up        # build + run the hardened container
make headers   # assert security headers are present
make scan      # Trivy image CVE scan (if installed)
docker exec stellar-pay id   # confirm non-root (uid=101)
```

---

## Reporting a vulnerability

This is an educational Testnet project with no real funds at risk. If you spot an
issue, please open a GitHub issue describing it.

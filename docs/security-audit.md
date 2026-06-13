# Security Audit — Stem Extractor

**Target:** Stem Extractor (`github.com/gobelinor/stem-extractor`)
**Type:** 100% client-side static web app — Vite + React 19 + TypeScript + Tailwind v4. No backend, no auth, no server-side state.
**Deploy:** Cloudflare Pages (direct upload via wrangler). Security headers + CSP in `public/_headers`. Cloudflare Web Analytics beacon in `index.html`.
**Audit date:** 2026-06-01
**Method:** Full source read of every file under `src/`, all config (`public/_headers`, `wrangler.jsonc`, `vite.config.ts`, `index.html`, `package.json`, `package-lock.json`), `npm audit`, `git log -p` secret grep, XSS-sink grep, slugify fuzzing, and live-header verification against the deployed origin.

---

## Executive summary

This is a small, well-built, client-only application with a deliberately tiny dependency surface (only `react` + `react-dom` as runtime deps) and a thoughtfully restrictive Content-Security-Policy that is correctly served live. There is **no server, no authentication, no user data store, and no persistence** — which removes the entire class of classic web vulnerabilities (SQLi, SSRF, IDOR, auth bypass, stored XSS, CSRF on state-changing endpoints, etc.).

The audit found **no Critical, High, or Medium severity vulnerabilities.** `npm audit` reports 0 vulnerabilities, no secrets are present in the repo or git history, there are no XSS sinks (`dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`), the AudioWorklet blob source is a fixed string with no user/device input interpolated into it, and the filename `slugify()` strictly whitelists `[a-z0-9-]`, defeating path traversal.

What remains is a short list of **Low / Info hardening opportunities**: a couple of CSP polish items (a `connect-src`/reporting-endpoint mismatch, missing `form-action`/`frame-src`, `style-src 'unsafe-inline'`), the absence of Subresource Integrity on the externally-hosted Cloudflare beacon, and the lack of a privacy disclosure for the analytics beacon. None of these are exploitable on their own; they are defense-in-depth.

**Overall risk: LOW.** The app is in good shape. The recommendations below are polish, not fire-fighting.

---

## Attack-surface overview

Because the app is static and client-only, the realistic threat actors and what they can reach are:

| Actor | Reachable surface | Realistic impact |
|---|---|---|
| **Malicious web page / other origin** | Cannot reach this app's state — it is same-origin isolated. `frame-ancestors 'none'` + `X-Frame-Options: DENY` block framing/clickjacking. COOP `same-origin` isolates the browsing context. | None. |
| **Network MITM** | App is HTTPS-only on Cloudflare Pages (secure context is mandatory for Web MIDI / getUserMedia anyway). | Negligible; HTTPS + HSTS-by-Cloudflare. |
| **Malicious dependency / supply chain** | 2 runtime deps (react, react-dom); the rest are devDeps (vite, wrangler, tailwind). 5 packages have install scripts (esbuild, fsevents, sharp, workerd ×wrangler) — all standard, all dev-time. | Build-time risk only; not shipped to users. |
| **Malicious / spoofed MIDI device** | Sends untrusted MIDI bytes into `useMidi.decode()` and the BPM clock measurement. Rendered only as text inside React (auto-escaped). | At most: garbage in the diagnostic log, or a nonsense BPM number. No code execution, no injection. |
| **Malicious / spoofed audio device** | Float32 PCM into the WAV encoder; values are clamped to [-1,1]. | At most a large RAM allocation (the app already warns about memory on long captures). |
| **Malicious file/folder (File System Access API)** | User picks a directory; app writes `<slug>/...wav` into it. Filenames are slugified to `[a-z0-9-]`. | No traversal; writes confined to the user-chosen folder, by design of the API + slugify. |
| **Operator / deploy** | Cloudflare API token (used once, deleted) — not in repo or history. Public analytics beacon token in `index.html` (expected to be public). | None found. |

The genuinely "interesting" surfaces for a client app like this are: (1) the **AudioWorklet blob** (code-from-string), (2) **filename construction** feeding a filesystem write, and (3) **untrusted device input** reaching the DOM. All three were examined closely and are safe (see findings).

---

## Findings table (severity-sorted)

| # | Severity | Title | Location |
|---|---|---|---|
| 1 | Low | CSP `connect-src` does not match the beacon's reporting host; no SRI on external beacon | `public/_headers:10`, `index.html:12-16` |
| 2 | Low | CSP missing `form-action`, `frame-src`/`child-src`; relies on `default-src` fallbacks | `public/_headers:10` |
| 3 | Low | `style-src 'unsafe-inline'` is broad (Tailwind v4 / Vite injects inline styles) | `public/_headers:10` |
| 4 | Info | No privacy disclosure for Cloudflare Web Analytics beacon | `index.html:11-16`, `README.md` |
| 5 | Info | External beacon script loaded without `integrity` (SRI) | `index.html:12-16` |
| 6 | Info | `sysex:true` requested for Web MIDI (broad capability, but functionally needed) | `src/engine/midi/MidiEngine.ts:23` |
| 7 | Info | Untrusted MIDI bytes drive the diagnostic decoder & BPM measurement (handled safely) | `src/ui/hooks/useMidi.ts:20-31`, `MidiEngine.ts:84-130` |
| 8 | Info | Unbounded in-RAM capture buffers (DoS-self only; already warned in UI) | `src/engine/audio/AudioRecorder.ts:66-103` |
| 9 | Info | No security headers for the local Vite dev server (dev-only) | `vite.config.ts` |

### Explicitly checked and found CLEAN (no finding)

- **XSS / injection:** no `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `document.write`, `insertAdjacentHTML`, `eval`, or `new Function` anywhere in `src/` or `index.html`. All device/MIDI text (`decode()` output, port names, device labels) is rendered as React children/`<pre>` text content and auto-escaped.
- **AudioWorklet blob source** (`src/engine/audio/recorder-worklet.ts`): the worklet body is a constant template literal. The only interpolation is `${JSON.stringify(RECORDER_PROCESSOR)}` — a hard-coded constant `"stem-recorder"`. No user, device, or network input reaches the string. Not exploitable.
- **Path traversal / filename injection** (`naming.ts`, `download.ts`): `slugify()` whitelists `[a-z0-9]` and collapses everything else to `-`, then trims. Fuzzed with `../../etc/passwd`, `..\..\win`, `....//....//x`, `a/b/c`, `:weird::`, `..`, `""` → outputs `etc-passwd`, `win`, `x`, `a-b-c`, `weird`, `project`, `project`. No separators survive. The File System Access `getDirectoryHandle`/`getFileHandle` calls additionally reject path separators. Stem filenames go through `stemFileName()` → `slugify()` too. Confined to the user-picked folder.
- **ReDoS:** the slugify regexes (`/[^a-z0-9]+/g`, `/^-+|-+$/g`, `/[̀-ͯ]/g`) and the bars validator (`/^\d+$/`) are all linear; no nested quantifiers / catastrophic backtracking. Inputs are also short (project name, a number field). Not exploitable.
- **Prototype pollution:** no recursive merge, no `Object.assign` from untrusted sources, no bracket assignment from device data into object keys. None present.
- **Secrets:** `git log -p` greps for `api[_-]?token`, `secret`, `password`, `CLOUDFLARE_API`, `Bearer`, `-----BEGIN`, `private[_-]key` returned nothing. `git ls-files` shows no `.env`, no `wrangler.toml` with creds, no key files. `.gitignore` correctly excludes `.env*`, `.wrangler/`, `dist/`. The analytics token in `index.html` is a public client-side beacon token (by design) — not a leak.
- **npm audit:** 0 vulnerabilities. 243 packages in lockfile, install scripts only on standard dev tooling (esbuild, fsevents, sharp, workerd). Lockfile present and pinned.
- **Clickjacking:** `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` (belt and suspenders) — clean.
- **Live headers:** verified against the deployed origin — the CSP and all security headers are served exactly as written in `_headers` (Cloudflare also adds NEL/report-to). The `_headers` file is effective in production.

---

## Detailed findings

### 1. CSP `connect-src` / reporting-host mismatch + no SRI on the beacon — **Low**

**Location:** `public/_headers:10`, `index.html:12-16`

**Description.** The CSP allows the beacon script from `https://static.cloudflareinsights.com` (`script-src`) but `connect-src` only lists `https://cloudflareinsights.com`. Cloudflare's beacon (`beacon.min.js`) typically POSTs its analytics payload to `https://cloudflareinsights.com/cdn-cgi/rum`, so the connect host is the right one — but the two hostnames are different (`static.` for the script, bare for the report), which is easy to get wrong and worth an explicit comment. More importantly, if Cloudflare ever changes the RUM ingest host, analytics silently break (fail-closed, which is fine security-wise). This is correct-but-fragile rather than a hole.

**Impact.** No security impact. Defense-in-depth / maintainability note. Worst case: analytics stop reporting if Cloudflare changes hosts.

**Fix.** Keep `connect-src 'self' https://cloudflareinsights.com` (it is correct today), and add a comment in `_headers` documenting *why* the two cloudflareinsights hostnames differ. Consider whether analytics is worth the extra origins at all (see finding 4).

---

### 2. CSP missing `form-action` and `frame-src`/`child-src` — **Low**

**Location:** `public/_headers:10`

**Description.** The CSP sets `default-src 'self'` and `object-src 'none'`, which is good, but does not explicitly set:
- `form-action` — there are no `<form>` elements today, but adding one later (e.g. a feedback form) would be governed only by the `default-src` fallback, and `form-action` does **not** fall back to `default-src` in all engines historically. An explicit `form-action 'none'` (or `'self'`) is cheap.
- `frame-src` / `child-src` — no iframes today; `default-src 'self'` covers it, but `frame-src 'none'` makes intent explicit and blocks any future accidental iframe embed of third-party content.
- `base-uri` is already correctly set to `'self'` (good — blocks `<base>` hijacking).

**Impact.** None today (no forms, no frames). Hardening for future changes.

**Fix.** Append `form-action 'none'; frame-src 'none';` to the CSP. Optionally `manifest-src 'self'`.

---

### 3. `style-src 'unsafe-inline'` — **Low**

**Location:** `public/_headers:10`

**Description.** `style-src 'self' 'unsafe-inline'` permits arbitrary inline styles. Tailwind v4 + Vite inject styles, and React inline `style=` attributes / dynamically injected `<style>` are common, so this is the pragmatic setting and is widely used. The residual risk is that `'unsafe-inline'` on styles enables CSS-based exfiltration tricks *if* an HTML-injection primitive existed — but there is no HTML injection sink in this app (see clean list), so it is not currently leverageable.

**Impact.** Minimal. Only matters in combination with an HTML-injection bug, of which there are none.

**Fix (optional, higher effort).** Move to nonce/hash-based styles if you ever eliminate runtime-injected CSS. For a Tailwind/Vite SPA this is usually not worth the build complexity; documenting the decision is sufficient. Note that script-src does **not** use `'unsafe-inline'` (good) — the higher-value directive is already tight.

---

### 4. No privacy disclosure for Cloudflare Web Analytics — **Info**

**Location:** `index.html:11-16`, `README.md` (no mention)

**Description.** The app injects the Cloudflare Web Analytics beacon, which sends page-view / RUM telemetry (URL, referrer, timing, coarse UA/geo) to Cloudflare on every load. The README and UI contain no privacy notice or analytics disclosure. The app is otherwise genuinely privacy-preserving (audio never leaves the browser; stems are local-only), so a single beacon is the *only* data that leaves the user's machine — which makes disclosing it both easy and high-value for user trust. Cloudflare Web Analytics is cookieless and does not fingerprint, so this is low-sensitivity, but undisclosed telemetry is still worth a line.

**Impact.** Privacy/transparency, not a vulnerability. No PII beyond standard request metadata.

**Fix.** Add one sentence to the README (and ideally the footer): "This site uses Cloudflare Web Analytics (cookieless) for aggregate page-view stats. No audio, MIDI, or captured data ever leaves your browser." Optionally make the beacon removable for self-hosters.

---

### 5. External beacon loaded without Subresource Integrity — **Info**

**Location:** `index.html:12-16`

**Description.** `<script src="https://static.cloudflareinsights.com/beacon.min.js">` has no `integrity` attribute. If Cloudflare's CDN were compromised, a malicious `beacon.min.js` would execute in the app's origin (the CSP already allows that exact host in `script-src`). SRI is the standard mitigation, but Cloudflare's beacon is intentionally a mutable, frequently-updated file and Cloudflare does **not** publish a stable hash for it, so pinning SRI would break the beacon on every update. This is the same trust assumption as trusting Cloudflare to host the whole site (which you already do for Pages).

**Impact.** Theoretical supply-chain risk via the analytics host, bounded by the fact that you already fully trust Cloudflare to serve the site. Low.

**Fix.** Accept the residual risk (recommended — you already trust Cloudflare end-to-end), OR drop the third-party beacon entirely in favor of Cloudflare Pages' built-in server-side analytics (no client script, no extra origin, no SRI question). The latter also resolves findings 1 and 4.

---

### 6. `sysex:true` on `requestMIDIAccess` — **Info**

**Location:** `src/engine/midi/MidiEngine.ts:23`

**Description.** The app requests SysEx capability: `navigator.requestMIDIAccess({ sysex: true })`. SysEx is the most privileged MIDI tier — it can send/receive system-exclusive messages that on some devices read/write firmware, presets, or memory. The browser shows a distinct, stronger permission prompt for SysEx. In this codebase the app **only sends** CC9 (mute), clock, start/stop, and **only reads** clock + CC/note for the diagnostic log — it does not actually send any SysEx payloads. So the elevated capability is requested but barely used.

**Impact.** Over-broad capability request. A future bug (or a malicious dependency that got code execution) could use the granted SysEx channel to send arbitrary SysEx to the connected hardware. Today, no SysEx is sent, so the practical risk is the principle-of-least-privilege gap plus a scarier user prompt.

**Fix.** If no current machine driver needs SysEx (the OP-XY driver here uses plain CC/clock), request `requestMIDIAccess({ sysex: false })` (or no options). Add `sysex: true` back per-driver only when a driver genuinely needs it. This also gives users a lighter permission prompt. If SysEx is reserved for planned features, document that intent in a comment.

---

### 7. Untrusted MIDI input → diagnostic decoder & BPM measurement — **Info**

**Location:** `src/ui/hooks/useMidi.ts:20-31` (`decode`), `src/engine/midi/MidiEngine.ts:84-130` (`measureClockBpm`/`bpmFromStamps`)

**Description.** Incoming MIDI bytes from any connected device are untrusted. They flow to:
- `decode(data)` → produces a short text line (`CC9 ch1 = 127`, `Note On…`, or `0x<hex>`), inserted into a React state array and rendered inside `<pre>` as text. React escapes it; no template/HTML injection. The log is capped at 30 lines (`slice(0, 30)`), so no unbounded growth.
- `measureClockBpm` → collects up to 144 timestamps, then a least-squares slope. A hostile device flooding clock ticks resolves the promise quickly with a possibly-nonsense BPM; a silent device hits the 12s timeout and rejects cleanly. The BPM is then clamped by the UI (`min=20 max=300` on the input) and used only to schedule local timers. Division-by-zero / NaN from degenerate timestamps would at worst produce `NaN`/`Infinity` BPM, surfaced harmlessly in the UI.

**Impact.** None beyond cosmetic garbage in the diagnostic panel or a wrong tempo. No code execution, no injection, no DoS (log is bounded, measurement is bounded/timed out).

**Fix.** No change required. Optionally guard `bpmFromStamps` against a zero/negative slope to avoid showing `Infinity`/`NaN` BPM, and clamp the resolved BPM into [20,300] before applying.

---

### 8. Unbounded in-RAM capture buffers — **Info**

**Location:** `src/engine/audio/AudioRecorder.ts:66-103`, `src/engine/capture/StemCapture.ts`

**Description.** Audio chunks accumulate in `this.chunks` for the whole capture and are concatenated into per-channel `Float32Array`s; all stems are kept as Blobs + object URLs in React state until downloaded. A very long capture (the UI allows up to 512 bars × 8 tracks) can consume substantial memory. This is a self-inflicted resource issue, not attacker-controlled: the user sets the duration, and the UI **already warns** ("long capture, keep an eye on memory — stems are held in RAM until downloaded", `CaptureControls.tsx:208-213`).

**Impact.** At worst the user's own tab OOMs/slows on an extreme capture they configured. No cross-origin or remote angle.

**Fix.** None required. Optional: revoke stem object URLs on reset/unmount (`URL.revokeObjectURL`) to free memory sooner, and consider streaming long captures to disk via the File System Access writable stream instead of buffering whole takes.

---

### 9. No security headers on the local dev server — **Info**

**Location:** `vite.config.ts`

**Description.** `public/_headers` is a Cloudflare Pages construct and is **not** applied by the Vite dev server (`npm run dev`). Locally the app runs on `http://localhost:5173` with no CSP. This is normal and dev-only; production (the thing users hit) is correctly covered, as verified against the live origin.

**Impact.** None for end users. Only affects the developer's local environment.

**Fix.** No action needed. If desired for parity, a small Vite `server.headers` block could mirror the CSP in dev.

---

## Prioritized remediation list

Everything here is **hardening** — there is no urgent fix. In rough priority order:

1. **(Info→Low, easy, high trust value)** Add a one-line privacy disclosure for the Cloudflare beacon to the README + footer (finding 4). Consider switching to Cloudflare Pages' server-side analytics to drop the client beacon entirely — this single change also resolves findings 1 and 5.
2. **(Info, easy, least-privilege)** Drop `sysex: true` unless a driver actually needs it; today the OP-XY driver does not send SysEx (finding 6). Lighter permission prompt + smaller blast radius.
3. **(Low, trivial)** Tighten the CSP: add `form-action 'none'; frame-src 'none';`, and add a comment explaining the two `cloudflareinsights` hostnames (findings 1, 2).
4. **(Info, optional)** Guard `bpmFromStamps` against degenerate slopes and clamp resolved BPM to [20,300] (finding 7).
5. **(Info, optional)** Revoke stem object URLs on reset/unmount to free memory (finding 8).
6. **(Low, optional / document-the-decision)** Revisit `style-src 'unsafe-inline'` only if you can eliminate runtime-injected CSS; otherwise document that it is an accepted Tailwind/Vite tradeoff (finding 3).

**Bottom line:** the application is secure for its design. The CSP is strong and live-verified, dependencies are minimal and clean, there are no injection sinks, no secrets, and the device/file inputs are handled safely. The recommendations above are incremental polish, not remediation of exploitable bugs.

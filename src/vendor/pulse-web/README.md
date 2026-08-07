# Vendored from the pulse/NightOut web repo

These files are copies of shared concierge-client logic from the web repo
(`shared/concierge-client/` and select `src/utils/`, `src/constants/` files),
vendored here because EAS cloud builds can't reach a sibling repo directory —
only the mobile repo gets cloned.

Previously this was resolved at build time via a custom Metro resolver
(`@pulse-web/...` → sibling `../NightOut` or `../pulse` directory, see git
history on `metro.config.js` / `scripts/resolvePulseWebRoot.js`), which worked
in local dev (both repos cloned as siblings) but failed on every EAS Build
with `Could not find pulse web repo`.

**This directory structure intentionally mirrors the web repo's own layout**
(`shared/concierge-client/*.js`, `src/utils/*.js`, `src/constants/*.js`) so
the files' own internal relative imports (e.g. `../../src/utils/...`) resolve
correctly without any changes to their contents — only the 3 call sites that
used to import via `@pulse-web/` were changed, to import from here instead.

## Keeping this in sync

There's no automated sync — if the web repo's copies of these files change,
re-copy them here manually. If this drifts often enough to be painful, the
better long-term fix is to extract `shared/concierge-client/` (and its
dependencies) into its own small package that both repos install as a normal
dependency, replacing this vendoring (and the web repo's own local imports)
entirely.

## Files

- `shared/concierge-client/*.js` — concierge request/response client logic
- `src/constants/appBrand.js` — brand-name regex constants
- `src/utils/*.js` — location/neighborhood registries and matching,
  concierge conversation-state helpers, and their transitive dependencies

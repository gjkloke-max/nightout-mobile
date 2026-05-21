const fs = require('fs')
const path = require('path')

/**
 * Locate the Brio web repo (NightOut / pulse) for shared/concierge-client imports.
 * Local dev: ../NightOut. Staging: ../pulse or PULSE_WEB_ROOT=/var/www/pulse.
 * @param {string} mobileRepoRoot - __dirname of pulse-mobile project root
 */
function resolvePulseWebRoot(mobileRepoRoot) {
  const candidates = [
    process.env.PULSE_WEB_ROOT,
    path.resolve(mobileRepoRoot, '..', 'pulse'),
    path.resolve(mobileRepoRoot, '..', 'NightOut'),
  ].filter(Boolean)

  for (const root of candidates) {
    const marker = path.join(root, 'shared', 'concierge-client', 'index.js')
    if (fs.existsSync(marker)) return root
  }

  throw new Error(
    'Could not find pulse web repo (shared/concierge-client). ' +
      'Clone pulse beside pulse-mobile (/var/www/pulse) or set PULSE_WEB_ROOT.',
  )
}

module.exports = { resolvePulseWebRoot }

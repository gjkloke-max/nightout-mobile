const fs = require('fs')
const path = require('path')

/**
 * Locate the Brio web repo (NightOut / pulse) for shared/concierge-client imports.
 * Local dev: ../NightOut. Staging: ../appbrio or PULSE_WEB_ROOT=/var/www/appbrio.
 * @param {string} mobileRepoRoot - __dirname of appbrio-mobile project root
 */
function resolvePulseWebRoot(mobileRepoRoot) {
  const candidates = [
    process.env.PULSE_WEB_ROOT,
    path.resolve(mobileRepoRoot, '..', 'appbrio'),
    path.resolve(mobileRepoRoot, '..', 'pulse'),
    path.resolve(mobileRepoRoot, '..', 'NightOut'),
  ].filter(Boolean)

  for (const root of candidates) {
    const marker = path.join(root, 'shared', 'concierge-client', 'index.js')
    if (fs.existsSync(marker)) return root
  }

  throw new Error(
    'Could not find pulse web repo (shared/concierge-client). ' +
      'Clone web repo beside appbrio-mobile (/var/www/appbrio) or set PULSE_WEB_ROOT.',
  )
}

module.exports = { resolvePulseWebRoot }

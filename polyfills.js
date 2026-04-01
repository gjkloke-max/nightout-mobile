/**
 * Hermes / RN can throw ReferenceError: Property 'useLayoutEffect' doesn't exist
 * when a dependency expects React.useLayoutEffect during early init.
 * Fallback to useEffect (timing differs slightly but avoids a hard crash).
 */
import * as React from 'react'

if (typeof React.useLayoutEffect !== 'function' && typeof React.useEffect === 'function') {
  // eslint-disable-next-line no-import-assign
  React.useLayoutEffect = React.useEffect
}

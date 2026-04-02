/**
 * Design system colors — Figma NewCo + neutral zinc.
 * Browse tab + badges: Figma node 36:1311 (AppLayout) — `browseAccent` (#9d174d), not web profile #8B1D3D.
 * @see https://www.figma.com/design/c1IDoYUdmW6udWmwTYyDVz/NewCo-Design?node-id=36-1311
 */

export const colors = {
  // Backgrounds (NewCo canvas + surfaces)
  background: '#FAFAFA',
  /** Figma 36:1311 main container fill */
  backgroundCanvas: '#FAFAF8',
  backgroundElevated: '#FFFFFF',
  backgroundMuted: '#F4F4F5',
  backgroundDark: '#18181B',
  surface: '#F4F4F5',
  surfaceLight: '#FAFAFA',

  // Text (align with web NewCo / zinc)
  textPrimary: '#18181B',
  textSecondary: '#71717B',
  textMuted: '#A1A1AA',
  /** Figma Browse venue card tags — Inter 10 uppercase */
  textTag: '#9F9FA9',
  /** Figma Browse search underline + inactive tab stroke */
  borderInput: '#D4D4D8',
  /** Figma Browse search row — focused state (node 53:152) */
  borderSearchFocused: '#B2B2B7',
  /** Figma active tab label on dark pill */
  textOnTabActive: '#FAFAF8',
  textOnDark: '#FFFFFF',

  // Accents — NewCo burgundy; purple retained for chat/social/modals where used
  accent: '#7F22FE',
  profileAccent: '#8B1D3D',
  profileAccentPressed: '#731832',
  /** Figma 36:1311 — active tab label + rating badge fill (rose/burgundy) */
  browseAccent: '#9d174d',
  browseAccentBorder: '#831843',
  /** Alternate badge fill used in same frame */
  browseAccentAlt: '#be185d',
  accentPressed: '#6D1ED9',
  accentMuted: 'rgba(127, 34, 254, 0.12)',
  link: '#7F22FE',

  // Semantic
  success: '#00BC7D',
  error: '#FB2C36',
  warning: '#C4A35A',

  // Borders
  border: '#E4E4E7',
  borderLight: '#E4E4E7',
}

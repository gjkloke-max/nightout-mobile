/** Official product name (user-facing). */
export const APP_DISPLAY_NAME = 'Brio'

/** Strip legacy concierge headings from model output (Pulse → Brio rename). */
export const CONCIERGE_USERS_SAYING_HEADING_RE =
  /#+\s*What (?:Pulse|Brio) Users Are Saying\s*|What (?:Pulse|Brio) Users Are Saying:?\s*/gi

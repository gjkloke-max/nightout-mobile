/**
 * Reporting objectionable content, required by App Store Guideline 1.2 alongside blocking.
 *
 * Insert-only by design: the RLS policy lets a signed-in person file a report and read none,
 * including their own. Triage happens server-side with the service role, so a report cannot be
 * inspected, edited or withdrawn by whoever is being reported.
 */
import { supabase } from '../lib/supabase'

/** Matches the content_type CHECK constraint on public.content_report. */
export const REPORT_CONTENT_TYPE = {
  REVIEW: 'review',
  COMMENT: 'comment',
  PROFILE: 'profile',
  MESSAGE: 'message',
  LIST: 'list',
}

/**
 * Offered verbatim in the picker, so the wording is the person's answer rather than a category we
 * infer later. "Something else" carries free text.
 */
export const REPORT_REASONS = [
  'Harassment or bullying',
  'Hate speech',
  'Spam or misleading',
  'Sexually explicit',
  'Violence or threats',
  'Impersonation',
  'Something else',
]

/**
 * @param {object} params
 * @param {string} params.contentType one of REPORT_CONTENT_TYPE
 * @param {string|number} params.contentId
 * @param {string|null} [params.reportedUserId] author, when known
 * @param {string} params.reason one of REPORT_REASONS
 * @param {string} [params.details] free text
 * @returns {Promise<{ error: { message: string }|null }>}
 */
export async function submitReport({ contentType, contentId, reportedUserId, reason, details }) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: { message: 'You are signed out.' } }
  if (!contentType || contentId == null || !reason) {
    return { error: { message: 'Please choose a reason.' } }
  }
  const { error } = await supabase.from('content_report').insert({
    reporter_user_id: user.id,
    content_type: contentType,
    // text column: the things being reported have different key types (bigint review ids, uuid
    // profile and message ids), so they are normalised to text at the boundary.
    content_id: String(contentId),
    reported_user_id: reportedUserId || null,
    reason,
    details: (details || '').trim() || null,
  })
  if (error) {
    console.warn('[contentReports] submit', error)
    return { error: { message: 'Could not send the report. Please try again.' } }
  }
  return { error: null }
}

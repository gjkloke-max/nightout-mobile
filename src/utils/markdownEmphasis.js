/**
 * Remove markdown emphasis markers from concierge prose.
 *
 * Neither app renders markdown: answers are plain text with venue names turned into links
 * (conciergeLinkUtils.splitTextWithVenueLinks). The models still sometimes bold venue names
 * ("consider **Ludlow Charlingtons Coffee Shop**") despite being told to write names as plain
 * text, and the asterisks then show up literally around the link.
 *
 * The server strips these right before sending an answer (after venueLinkAlignment, which uses
 * the bold markers to recognise short forms of names); the link splitter strips them again so
 * chat history saved before that fix also reads cleanly.
 *
 * Keep in sync with NightOut web: src/utils/markdownEmphasis.js
 *
 * @param {string} text
 * @returns {string}
 */
export function stripMarkdownEmphasis(text) {
  return String(text || '')
    // **bold** and __bold__
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '$1')
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?![\w])/g, '$1$2')
    // *italic* — only a word-wrapping pair, so "5 * 3" or a lone "*" is left alone
    .replace(/(^|[^\w*])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![\w*])/g, '$1$2')
    // any unmatched leftover "**"
    .replace(/\*\*/g, '')
}

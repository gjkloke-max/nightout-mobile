/**
 * Venue-card crowd sentiment: positive-forward tags from search_text with evidence thresholds
 * and coherent final selection (no hedging / pros-cons phrasing).
 */

export const CROWD_SENTIMENT_MAX_TAGS = 6

/** Minimum total score for a candidate to be eligible. */
const MIN_ELIGIBLE_SCORE = 3.5

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function norm(text) {
  return (text || '').toLowerCase().trim()
}

/** Word-boundary occurrence count. */
export function countPhraseHits(text, phrase) {
  const p = norm(phrase)
  if (!p || !text) return 0
  const re = new RegExp(`\\b${escapeRe(p).replace(/\s+/g, '\\s+')}\\b`, 'gi')
  return (norm(text).match(re) || []).length
}

/** How many sentence-like chunks mention this phrase (proxy for multiple reviewers). */
export function countChunkHits(text, phrase) {
  const p = norm(phrase)
  if (!p || !text) return 0
  const re = new RegExp(`\\b${escapeRe(p).replace(/\s+/g, '\\s+')}\\b`, 'i')
  const chunks = norm(text).split(/[.!?\n]+/).filter((c) => c.trim().length > 12)
  return chunks.filter((c) => re.test(c)).length
}

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   exclusiveGroup?: string,
 *   conflictIds?: string[],
 *   phrases: { text: string, weight?: number, minHits?: number }[],
 *   strongPhrases?: { text: string, weight?: number }[],
 *   minScore?: number,
 *   priority?: number,
 * }} CrowdSentimentCandidate
 */

/** @type {CrowdSentimentCandidate[]} */
const CANDIDATES = [
  {
    id: 'cozy',
    label: 'cozy setting',
    exclusiveGroup: 'ambience-intimate',
    phrases: [{ text: 'cozy', weight: 1, minHits: 3 }, { text: 'intimate', weight: 1.1, minHits: 2 }],
    strongPhrases: [
      { text: 'cozy atmosphere', weight: 2.5 },
      { text: 'cozy spot', weight: 2 },
      { text: 'intimate setting', weight: 2 },
    ],
    priority: 2,
  },
  {
    id: 'romantic',
    label: 'date-night feel',
    exclusiveGroup: 'occasion-date',
    phrases: [{ text: 'date night', weight: 2, minHits: 1 }, { text: 'romantic', weight: 1.2, minHits: 2 }],
    strongPhrases: [
      { text: 'perfect for date night', weight: 2.5 },
      { text: 'romantic dinner', weight: 2 },
      { text: 'romantic spot', weight: 2 },
    ],
    priority: 3,
  },
  {
    id: 'casual',
    label: 'casual atmosphere',
    exclusiveGroup: 'formality',
    conflictIds: ['upscale'],
    phrases: [{ text: 'casual', weight: 1.2, minHits: 2 }],
    strongPhrases: [
      { text: 'casual spot', weight: 2 },
      { text: 'laid back', weight: 1.8 },
      { text: 'laid-back', weight: 1.8 },
      { text: 'relaxed vibe', weight: 1.8 },
    ],
    priority: 2,
  },
  {
    id: 'upscale',
    label: 'upscale feel',
    exclusiveGroup: 'formality',
    conflictIds: ['casual'],
    phrases: [{ text: 'upscale', weight: 1.3, minHits: 2 }, { text: 'fine dining', weight: 2, minHits: 1 }],
    strongPhrases: [
      { text: 'elegant', weight: 1.5 },
      { text: 'special occasion', weight: 1.8 },
      { text: 'white tablecloth', weight: 2 },
    ],
    priority: 2,
  },
  {
    id: 'lively',
    label: 'lively vibe',
    exclusiveGroup: 'energy',
    phrases: [
      { text: 'lively', weight: 1.3, minHits: 2 },
      { text: 'vibrant', weight: 1.2, minHits: 2 },
      { text: 'energetic', weight: 1.1, minHits: 2 },
    ],
    strongPhrases: [
      { text: 'lively atmosphere', weight: 2.5 },
      { text: 'great energy', weight: 2 },
      { text: 'fun atmosphere', weight: 2 },
    ],
    priority: 2,
  },
  {
    id: 'groups',
    label: 'good for groups',
    exclusiveGroup: 'crowd-format',
    phrases: [
      { text: 'large group', weight: 2, minHits: 1 },
      { text: 'group dinner', weight: 2, minHits: 1 },
      { text: 'good for groups', weight: 2.5, minHits: 1 },
    ],
    strongPhrases: [{ text: 'big groups', weight: 1.8 }, { text: 'family style', weight: 1.8 }],
    priority: 2,
  },
  {
    id: 'neighborhood',
    label: 'neighborhood staple',
    exclusiveGroup: 'identity-local',
    phrases: [
      { text: 'neighborhood gem', weight: 2.5, minHits: 1 },
      { text: 'neighborhood spot', weight: 2, minHits: 1 },
      { text: 'local favorite', weight: 2, minHits: 1 },
      { text: 'go-to spot', weight: 2, minHits: 1 },
    ],
    strongPhrases: [
      { text: 'neighborhood staple', weight: 3 },
      { text: 'institution', weight: 1.5 },
      { text: 'beloved spot', weight: 2 },
    ],
    priority: 3,
  },
  {
    id: 'service',
    label: 'polished service',
    exclusiveGroup: 'service',
    phrases: [
      { text: 'friendly staff', weight: 1.5, minHits: 2 },
      { text: 'attentive', weight: 1.3, minHits: 2 },
      { text: 'great service', weight: 1.5, minHits: 2 },
      { text: 'excellent service', weight: 2, minHits: 1 },
    ],
    strongPhrases: [
      { text: 'impeccable service', weight: 2.5 },
      { text: 'service was outstanding', weight: 2 },
      { text: 'staff was wonderful', weight: 2 },
    ],
    minScore: 4,
    priority: 3,
  },
  {
    id: 'pasta',
    label: 'pasta standout',
    exclusiveGroup: 'food-signature',
    phrases: [{ text: 'pasta', weight: 1, minHits: 4 }],
    strongPhrases: [
      { text: 'best pasta', weight: 2.5 },
      { text: 'amazing pasta', weight: 2.5 },
      { text: 'pasta is incredible', weight: 2.5 },
      { text: 'fresh pasta', weight: 2 },
    ],
    minScore: 4.5,
    priority: 4,
  },
  {
    id: 'pizza',
    label: 'pizza standout',
    exclusiveGroup: 'food-signature',
    phrases: [{ text: 'pizza', weight: 1, minHits: 4 }],
    strongPhrases: [
      { text: 'best pizza', weight: 2.5 },
      { text: 'amazing pizza', weight: 2.5 },
      { text: 'great pizza', weight: 2 },
    ],
    minScore: 4.5,
    priority: 4,
  },
  {
    id: 'steak',
    label: 'steak standout',
    exclusiveGroup: 'food-signature',
    phrases: [
      { text: 'ribeye', weight: 1.5, minHits: 2 },
      { text: 'steak', weight: 1, minHits: 3 },
    ],
    strongPhrases: [
      { text: 'best steak', weight: 2.5 },
      { text: 'amazing steak', weight: 2.5 },
      { text: 'steakhouse', weight: 2 },
    ],
    minScore: 4,
    priority: 4,
  },
  {
    id: 'sushi',
    label: 'sushi standout',
    exclusiveGroup: 'food-signature',
    phrases: [{ text: 'sushi', weight: 1.2, minHits: 3 }],
    strongPhrases: [
      { text: 'best sushi', weight: 2.5 },
      { text: 'omakase', weight: 2 },
      { text: 'fresh sushi', weight: 2 },
    ],
    minScore: 4,
    priority: 4,
  },
  {
    id: 'tacos',
    label: 'taco standout',
    exclusiveGroup: 'food-signature',
    phrases: [{ text: 'tacos', weight: 1.2, minHits: 3 }, { text: 'taco', weight: 1, minHits: 4 }],
    strongPhrases: [{ text: 'best tacos', weight: 2.5 }, { text: 'amazing tacos', weight: 2.5 }],
    minScore: 4,
    priority: 4,
  },
  {
    id: 'cocktails',
    label: 'cocktails are a highlight',
    exclusiveGroup: 'drink',
    phrases: [{ text: 'cocktails', weight: 1.2, minHits: 3 }, { text: 'cocktail', weight: 1, minHits: 4 }],
    strongPhrases: [
      { text: 'best cocktails', weight: 2.5 },
      { text: 'amazing cocktails', weight: 2.5 },
      { text: 'craft cocktails', weight: 2.5 },
      { text: 'creative cocktails', weight: 2 },
    ],
    minScore: 4.5,
    priority: 4,
  },
  {
    id: 'wine',
    label: 'wine highlight',
    exclusiveGroup: 'drink',
    phrases: [{ text: 'wine', weight: 1, minHits: 4 }],
    strongPhrases: [
      { text: 'wine list', weight: 2 },
      { text: 'great wine', weight: 2.5 },
      { text: 'wine selection', weight: 2 },
    ],
    minScore: 4.5,
    priority: 3,
  },
  {
    id: 'brunch',
    label: 'brunch favorite',
    exclusiveGroup: 'food-meal',
    phrases: [{ text: 'brunch', weight: 1.3, minHits: 3 }],
    strongPhrases: [
      { text: 'best brunch', weight: 2.5 },
      { text: 'brunch spot', weight: 2 },
      { text: 'weekend brunch', weight: 2 },
    ],
    minScore: 4,
    priority: 4,
  },
  {
    id: 'patio',
    label: 'patio favorite',
    exclusiveGroup: 'feature',
    phrases: [
      { text: 'patio', weight: 1.2, minHits: 2 },
      { text: 'outdoor seating', weight: 1.8, minHits: 1 },
    ],
    strongPhrases: [{ text: 'rooftop', weight: 2 }, { text: 'great patio', weight: 2 }],
    priority: 1,
  },
  {
    id: 'happy-hour',
    label: 'happy hour favorite',
    exclusiveGroup: 'feature',
    phrases: [{ text: 'happy hour', weight: 2, minHits: 2 }],
    priority: 1,
  },
  {
    id: 'live-music',
    label: 'live music vibe',
    exclusiveGroup: 'feature',
    phrases: [{ text: 'live music', weight: 2, minHits: 2 }],
    priority: 1,
  },
]

const FOOD_SIGNATURE_MAX = 2

/**
 * @param {string} text
 * @param {CrowdSentimentCandidate} candidate
 */
export function scoreCrowdSentimentCandidate(text, candidate) {
  const t = norm(text)
  if (!t) return { score: 0, eligible: false, hits: 0, chunks: 0 }

  let score = 0
  let hits = 0
  let chunks = 0
  let phraseEvidence = false

  for (const row of candidate.phrases || []) {
    const h = countPhraseHits(t, row.text)
    const c = countChunkHits(t, row.text)
    const minHits = row.minHits ?? (row.text.split(/\s+/).length >= 2 ? 2 : 3)
    if (h >= minHits) {
      phraseEvidence = true
      const capped = Math.min(h, 5)
      score += (row.weight ?? 1) * capped * 0.85
      hits += h
      chunks = Math.max(chunks, c)
    }
  }

  for (const row of candidate.strongPhrases || []) {
    const h = countPhraseHits(t, row.text)
    if (h > 0) {
      phraseEvidence = true
      score += (row.weight ?? 2) * Math.min(h, 3)
      hits += h
      chunks = Math.max(chunks, countChunkHits(t, row.text))
    }
  }

  if (phraseEvidence && chunks >= 2) {
    score *= 1.15
  } else if (phraseEvidence && chunks === 0 && hits === 1) {
    score *= 0.55
  }

  const minScore = candidate.minScore ?? MIN_ELIGIBLE_SCORE
  const eligible = score >= minScore

  return { score, eligible, hits, chunks }
}

/**
 * @param {{ id: string, exclusiveGroup?: string, conflictIds?: string[] }} a
 * @param {{ id: string, exclusiveGroup?: string, conflictIds?: string[] }} b
 */
export function crowdSentimentTagsConflict(a, b) {
  if (a.id === b.id) return true
  if (a.conflictIds?.includes(b.id) || b.conflictIds?.includes(a.id)) return true
  if (a.exclusiveGroup && a.exclusiveGroup === b.exclusiveGroup) return true
  return false
}

/**
 * @param {Array<{ candidate: CrowdSentimentCandidate, score: number }>} ranked
 * @param {number} maxTags
 */
export function selectCoherentCrowdSentimentTags(ranked, maxTags = CROWD_SENTIMENT_MAX_TAGS) {
  /** @type {typeof ranked} */
  const selected = []
  let foodSignatureCount = 0

  for (const entry of ranked) {
    if (selected.length >= maxTags) break
    const c = entry.candidate
    if (c.exclusiveGroup === 'food-signature' && foodSignatureCount >= FOOD_SIGNATURE_MAX) {
      continue
    }
    if (selected.some((s) => crowdSentimentTagsConflict(s.candidate, c))) continue
    selected.push(entry)
    if (c.exclusiveGroup === 'food-signature') foodSignatureCount++
  }

  return selected.map((e) => e.candidate.label)
}

/**
 * @param {string} combinedText - venue_search_data.search_text (or fallback corpus)
 * @returns {string[]}
 */
export function deriveCrowdSentiment(combinedText) {
  if (!combinedText || typeof combinedText !== 'string') return []

  const scored = CANDIDATES.map((candidate) => {
    const { score, eligible } = scoreCrowdSentimentCandidate(combinedText, candidate)
    return { candidate, score, eligible }
  })
    .filter((row) => row.eligible)
    .sort((a, b) => {
      const pri = (b.candidate.priority ?? 0) - (a.candidate.priority ?? 0)
      if (pri !== 0) return pri
      return b.score - a.score
    })

  return selectCoherentCrowdSentimentTags(scored)
}

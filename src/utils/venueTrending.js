export const TRENDING_RANK_POOL_MAX = 200

export function isVenueInTrendingPool(venue) {
  const r = venue?.trending_rank
  if (r == null || r === '') return false
  const n = Number(r)
  return Number.isFinite(n) && n >= 1 && n <= TRENDING_RANK_POOL_MAX
}

export function trendingVenueNames(venues) {
  return (venues || [])
    .filter(isVenueInTrendingPool)
    .map((v) => String(v?.name || '').trim())
    .filter(Boolean)
}

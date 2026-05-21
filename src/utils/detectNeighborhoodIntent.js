/**
 * Detect neighborhood intent in a search query.
 * Keep in sync with NightOut `src/utils/detectNeighborhoodIntent.js`.
 */

const COMMUNITY_AREAS = [
  'GREATER GRAND CROSSING',
  'NEAR NORTH SIDE',
  'NEAR SOUTH SIDE',
  'NEAR WEST SIDE',
  'NORTH LAWNDALE',
  'SOUTH LAWNDALE',
  'WASHINGTON HEIGHTS',
  'WASHINGTON PARK',
  'EAST GARFIELD PARK',
  'EAST SIDE',
  'EDGEWATER',
  'EDISON PARK',
  'FOREST GLEN',
  'FULLER PARK',
  'HUMBOLDT PARK',
  'HYDE PARK',
  'IRVING PARK',
  'JEFFERSON PARK',
  'LAKE VIEW',
  'LINCOLN PARK',
  'LINCOLN SQUARE',
  'LOGAN SQUARE',
  'LOWER WEST SIDE',
  'MCKINLEY PARK',
  'MONTCLARE',
  'MORGAN PARK',
  'MOUNT GREENWOOD',
  'NORTH CENTER',
  'NORTH PARK',
  'NORWOOD PARK',
  'PORTAGE PARK',
  'ROGERS PARK',
  'SOUTH CHICAGO',
  'SOUTH DEERING',
  'SOUTH SHORE',
  'WEST ELSDON',
  'WEST ENGLEWOOD',
  'WEST GARFIELD PARK',
  'WEST LAWN',
  'WEST PULLMAN',
  'WEST RIDGE',
  'WEST TOWN',
  'WOODLAWN',
  'ALBANY PARK',
  'ARCHER HEIGHTS',
  'ARMOUR SQUARE',
  'ASHBURN',
  'AUBURN GRESHAM',
  'AUSTIN',
  'AVALON PARK',
  'AVONDALE',
  'BELMONT CRAGIN',
  'BEVERLY',
  'BRIDGEPORT',
  'BRIGHTON PARK',
  'BURNSIDE',
  'CALUMET HEIGHTS',
  'CHATHAM',
  'CHICAGO LAWN',
  'CLEARING',
  'DOUGLAS',
  'DUNNING',
  'ENGLEWOOD',
  'GAGE PARK',
  'GARFIELD RIDGE',
  'GRAND BOULEVARD',
  'HEGEWISCH',
  'HERMOSA',
  'KENWOOD',
  'LOOP',
  'NEW CITY',
  'OAKLAND',
  'OHARE',
  'PULLMAN',
  'RIVERDALE',
  'ROSELAND',
  'UPTOWN',
]

const ALIASES = {
  'west loop': 'NEAR WEST SIDE',
  westloop: 'NEAR WEST SIDE',
  lp: 'LINCOLN PARK',
  'wicker park': 'WEST TOWN',
  wicker: 'WEST TOWN',
  'river north': 'NEAR NORTH SIDE',
  rivernorth: 'NEAR NORTH SIDE',
  'gold coast': 'NEAR NORTH SIDE',
  'old town': 'NEAR NORTH SIDE',
  bucktown: 'WEST TOWN',
  'ukrainian village': 'WEST TOWN',
  pilsen: 'LOWER WEST SIDE',
  'little italy': 'NEAR WEST SIDE',
  greektown: 'NEAR WEST SIDE',
  chinatown: 'ARMOUR SQUARE',
  'south loop': 'NEAR SOUTH SIDE',
  southloop: 'NEAR SOUTH SIDE',
  andersonville: 'EDGEWATER',
  boystown: 'LAKE VIEW',
  lakeview: 'LAKE VIEW',
  wrigley: 'LAKE VIEW',
  wrigleyville: 'LAKE VIEW',
  logan: 'LOGAN SQUARE',
  'noble square': 'WEST TOWN',
  humboldt: 'HUMBOLDT PARK',
}

/**
 * @param {string} query
 * @returns {{ detected: string | null, queryWithoutNeighborhood: string }}
 */
export function detectNeighborhoodIntent(query) {
  const q = (query || '').trim()
  if (!q) return { detected: null, queryWithoutNeighborhood: q }

  const qLower = q.toLowerCase()

  for (const [alias, canonical] of Object.entries(ALIASES)) {
    const re = new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`, 'i')
    if (re.test(q)) {
      const without = q.replace(re, ' ').replace(/\s+/g, ' ').trim()
      return { detected: canonical, queryWithoutNeighborhood: without || q }
    }
  }

  for (const area of COMMUNITY_AREAS) {
    const areaLower = area.toLowerCase()
    const re = new RegExp(`\\b${areaLower.replace(/\s+/g, '\\s+')}\\b`, 'i')
    if (re.test(qLower)) {
      const without = q.replace(re, ' ').replace(/\s+/g, ' ').trim()
      return { detected: area, queryWithoutNeighborhood: without || q }
    }
  }

  return { detected: null, queryWithoutNeighborhood: q }
}

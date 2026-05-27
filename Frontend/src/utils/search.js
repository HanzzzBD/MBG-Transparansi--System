const SEARCH_ALIAS_PATTERNS = [
  [/\bsmkn\b/gu, 'smk negeri'],
  [/\bsmpn\b/gu, 'smp negeri'],
  [/\bsman\b/gu, 'sma negeri'],
  [/\bsdn\b/gu, 'sd negeri'],
]

export function normalizeSearchText(value) {
  let text = String(value || '').toLowerCase().trim()

  SEARCH_ALIAS_PATTERNS.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement)
  })

  return text
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenizeSearch(value) {
  return normalizeSearchText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

export function matchesSearchTokens(values, query) {
  const tokens = tokenizeSearch(query)
  if (!tokens.length) return true

  const haystack = values
    .filter((value) => value !== undefined && value !== null)
    .map((value) => normalizeSearchText(value))

  return tokens.every((token) => haystack.some((value) => value.includes(token) || value.split(/\s+/).some((word) => getFuzzyScore(token, word) > 0)))
}

function levenshteinDistance(first, second) {
  if (first === second) return 0
  if (!first) return second.length
  if (!second) return first.length

  const previous = Array.from({ length: second.length + 1 }, (_, index) => index)
  const current = Array(second.length + 1).fill(0)

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    current[0] = firstIndex

    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      const cost = first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1
      current[secondIndex] = Math.min(
        previous[secondIndex] + 1,
        current[secondIndex - 1] + 1,
        previous[secondIndex - 1] + cost,
      )
    }

    for (let index = 0; index <= second.length; index += 1) {
      previous[index] = current[index]
    }
  }

  return previous[second.length]
}

function getFuzzyScore(queryToken, valueToken) {
  if (queryToken.length < 4 || valueToken.length < 4) return 0

  const distance = levenshteinDistance(queryToken, valueToken)
  const maxLength = Math.max(queryToken.length, valueToken.length)
  const similarity = 1 - distance / maxLength

  if (distance <= 1) return 28
  if (maxLength >= 7 && distance <= 2 && similarity >= 0.72) return 18
  return 0
}

function scoreValue(value, query) {
  const normalizedValue = normalizeSearchText(value)
  const normalizedQuery = normalizeSearchText(query)
  const queryTokens = tokenizeSearch(query)
  const valueTokens = tokenizeSearch(value)

  if (!normalizedValue || !queryTokens.length) return 0

  let score = 0
  if (normalizedValue === normalizedQuery) score += 1200
  if (normalizedValue.startsWith(normalizedQuery)) score += 650
  if (normalizedValue.includes(normalizedQuery)) score += 420

  queryTokens.forEach((queryToken) => {
    let best = 0
    valueTokens.forEach((valueToken) => {
      if (valueToken === queryToken) best = Math.max(best, 160)
      else if (valueToken.startsWith(queryToken)) best = Math.max(best, 110)
      else if (valueToken.includes(queryToken)) best = Math.max(best, 70)
      else best = Math.max(best, getFuzzyScore(queryToken, valueToken))
    })
    if (normalizedValue.includes(queryToken)) best = Math.max(best, 45)
    score += best
  })

  return score
}

export function rankBySearch(items, query, fieldConfigs) {
  const tokens = tokenizeSearch(query)
  if (!tokens.length) return items

  return items
    .map((item, index) => {
      const matchedTokens = new Set()
      const score = fieldConfigs.reduce((total, config) => {
        const weight = config.weight || 1
        const value = typeof config.value === 'function' ? config.value(item) : item?.[config.field]
        tokens.forEach((token) => {
          if (scoreValue(value, token) > 0) {
            matchedTokens.add(token)
          }
        })
        return total + scoreValue(value, query) * weight
      }, 0)
      return { item, index, score, matchedTokenCount: matchedTokens.size }
    })
    .filter((entry) => entry.score > 0 && entry.matchedTokenCount === tokens.length)
    .sort((first, second) => {
      if (second.score !== first.score) return second.score - first.score
      return first.index - second.index
    })
    .map((entry) => entry.item)
}

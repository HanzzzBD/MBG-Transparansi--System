const SEARCH_ALIAS_PATTERNS = [
  [/\bsmkn\b/gu, "smk negeri"],
  [/\bsmpn\b/gu, "smp negeri"],
  [/\bsman\b/gu, "sma negeri"],
  [/\bsdn\b/gu, "sd negeri"]
];

const normalizeSearchText = (value, { expandAliases = true } = {}) => {
  let text = String(value || "")
    .toLowerCase()
    .trim();

  if (expandAliases) {
    SEARCH_ALIAS_PATTERNS.forEach(([pattern, replacement]) => {
      text = text.replace(pattern, replacement);
    });
  }

  return text
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const tokenizeText = (value, options) =>
  normalizeSearchText(value, options)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const uniqueTokenSets = (sets) => {
  const seen = new Set();

  return sets
    .map((tokens) => tokens.filter(Boolean))
    .filter((tokens) => tokens.length > 0)
    .filter((tokens) => {
      const key = tokens.join("\u0000");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const getSearchTokenSets = (query) =>
  uniqueTokenSets([
    tokenizeText(query, { expandAliases: false }),
    tokenizeText(query, { expandAliases: true })
  ]);

const tokenizeSearch = (value) =>
  tokenizeText(value, { expandAliases: true });

const textContains = (value) => ({
  contains: value,
  mode: "insensitive"
});

const buildFieldTokenWhere = (tokens, fields = []) => ({
  AND: tokens.map((token) => ({
    OR: fields.map((field) => ({
      [field]: textContains(token)
    }))
  }))
});

const buildTokenSearchWhere = (query, fields = []) => {
  const tokenSets = getSearchTokenSets(query);
  const searchableFields = fields.filter(Boolean);

  if (!tokenSets.length || !searchableFields.length) {
    return {};
  }

  const alternatives = tokenSets.map((tokens) => buildFieldTokenWhere(tokens, searchableFields));
  return alternatives.length === 1 ? alternatives[0] : { OR: alternatives };
};

const buildBuilderTokenWhere = (tokens, builders) => ({
  AND: tokens.map((token) => ({
    OR: builders.flatMap((builder) => {
      const condition = builder(token);
      return Array.isArray(condition) ? condition : [condition];
    }).filter(Boolean)
  }))
});

const buildTokenSearchOr = (query, fieldBuilders = []) => {
  const tokenSets = getSearchTokenSets(query);
  const builders = fieldBuilders.filter(Boolean);

  if (!tokenSets.length || !builders.length) {
    return {};
  }

  const alternatives = tokenSets.map((tokens) => buildBuilderTokenWhere(tokens, builders));
  return alternatives.length === 1 ? alternatives[0] : { OR: alternatives };
};

const buildLooseTokenSearchWhere = (query, fields = []) => {
  return buildTokenSearchWhere(query, fields);
};

const hasSearchQuery = (query) => tokenizeSearch(query).length > 0;

const mergeWhereWithAnd = (baseWhere = {}, condition = {}) => {
  if (!condition || Object.keys(condition).length === 0) {
    return baseWhere;
  }

  const { AND: baseAnd, ...rest } = baseWhere || {};
  const andConditions = [
    ...(Array.isArray(baseAnd) ? baseAnd : baseAnd ? [baseAnd] : []),
    condition
  ].filter((item) => item && Object.keys(item).length > 0);

  return {
    ...rest,
    ...(andConditions.length ? { AND: andConditions } : {})
  };
};

const buildRankedSearchCandidateWhere = (baseWhere = {}, query, fields = []) =>
  mergeWhereWithAnd(baseWhere, buildLooseTokenSearchWhere(query, fields));

const getRankedSearchCandidateLimit = ({ page = 1, limit = 20, multiplier = 30, min = 500, max = 5000 } = {}) =>
  Math.max(min, Math.min(max, Number(page || 1) * Number(limit || 20) * multiplier));

const paginateRankedSearch = ({ items = [], query, fieldConfigs = [], pagination }) => {
  const rankedItems = rankBySearch(items, query, fieldConfigs);

  return {
    items: rankedItems.slice(pagination.skip, pagination.skip + pagination.limit),
    total: rankedItems.length
  };
};

const levenshteinDistance = (first, second) => {
  if (first === second) return 0;
  if (!first) return second.length;
  if (!second) return first.length;

  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  const current = Array(second.length + 1).fill(0);

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    current[0] = firstIndex;

    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      const cost = first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1;
      current[secondIndex] = Math.min(
        previous[secondIndex] + 1,
        current[secondIndex - 1] + 1,
        previous[secondIndex - 1] + cost
      );
    }

    for (let index = 0; index <= second.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[second.length];
};

const fuzzyTokenScore = (queryToken, valueToken) => {
  if (queryToken.length < 4 || valueToken.length < 4) return 0;

  const distance = levenshteinDistance(queryToken, valueToken);
  const maxLength = Math.max(queryToken.length, valueToken.length);
  const similarity = 1 - distance / maxLength;

  if (distance <= 1) return 28;
  if (maxLength >= 7 && distance <= 2 && similarity >= 0.72) return 18;
  return 0;
};

const scoreValue = (value, query) => {
  const normalizedValue = normalizeSearchText(value);
  const queryText = normalizeSearchText(query);
  const queryTokens = tokenizeSearch(query);
  const valueTokens = tokenizeSearch(value);

  if (!normalizedValue || !queryTokens.length) return 0;

  let score = 0;

  if (normalizedValue === queryText) score += 1200;
  if (normalizedValue.startsWith(queryText)) score += 650;
  if (normalizedValue.includes(queryText)) score += 420;

  queryTokens.forEach((queryToken) => {
    let bestTokenScore = 0;

    valueTokens.forEach((valueToken) => {
      if (valueToken === queryToken) bestTokenScore = Math.max(bestTokenScore, 160);
      else if (valueToken.startsWith(queryToken)) bestTokenScore = Math.max(bestTokenScore, 110);
      else if (valueToken.includes(queryToken)) bestTokenScore = Math.max(bestTokenScore, 70);
      else bestTokenScore = Math.max(bestTokenScore, fuzzyTokenScore(queryToken, valueToken));
    });

    if (normalizedValue.includes(queryToken)) bestTokenScore = Math.max(bestTokenScore, 45);
    score += bestTokenScore;
  });

  return score;
};

const rankBySearch = (items, query, fieldConfigs = []) => {
  const queryTokens = tokenizeSearch(query);
  if (!queryTokens.length) return items;

  return items
    .map((item, index) => {
      const matchedTokens = new Set();
      const score = fieldConfigs.reduce((total, config) => {
        const weight = config.weight || 1;
        const value = typeof config.value === "function" ? config.value(item) : item?.[config.field];
        queryTokens.forEach((token) => {
          if (scoreValue(value, token) > 0) {
            matchedTokens.add(token);
          }
        });
        return total + scoreValue(value, query) * weight;
      }, 0);

      return {
        item,
        index,
        matchedTokenCount: matchedTokens.size,
        score
      };
    })
    .filter((entry) => entry.score > 0 && entry.matchedTokenCount === queryTokens.length)
    .sort((first, second) => {
      if (second.score !== first.score) return second.score - first.score;
      return first.index - second.index;
    })
    .map((entry) => entry.item);
};

module.exports = {
  buildRankedSearchCandidateWhere,
  buildLooseTokenSearchWhere,
  buildTokenSearchOr,
  buildTokenSearchWhere,
  getRankedSearchCandidateLimit,
  hasSearchQuery,
  mergeWhereWithAnd,
  normalizeSearchText,
  paginateRankedSearch,
  rankBySearch,
  textContains,
  tokenizeSearch
};

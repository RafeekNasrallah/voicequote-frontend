export interface PriceListItem {
  name: string;
  price: number;
  unit?: string;
  aliases?: string[];
}

export interface QuoteItemWithPrice {
  name: string;
  qty: number;
  unit: string;
  price: number | null;
  lineTotal: number | null;
}

export interface PriceMatchCandidate {
  item: PriceListItem;
  score: number;
}

export interface MatchCandidateOptions {
  maxResults?: number;
  minScore?: number;
}

export interface ApplySavedPricesOptions {
  onlyMissingPrice?: boolean;
  fillEmptyUnit?: boolean;
}

export interface ApplySavedPricesResult<T> {
  items: T[];
  matchedCount: number;
}

interface NormalizedPriceListItem extends PriceListItem {
  normalizedUnit: string | null;
  searchKeys: string[];
}

const MATCH_ACCEPT_SCORE = 0.62;
const UNIT_MATCH_BONUS = 0.08;
const UNIT_MISMATCH_PENALTY = 0.12;
const UNIT_ALIASES: Record<string, string> = {
  ea: "each",
  each: "each",
  piece: "each",
  pieces: "each",
  pc: "each",
  pcs: "each",
  unit: "each",
  units: "each",

  hr: "hour",
  hrs: "hour",
  hour: "hour",
  hours: "hour",

  m: "meter",
  meter: "meter",
  meters: "meter",
  metre: "meter",
  metres: "meter",

  ft: "foot",
  foot: "foot",
  feet: "foot",

  sqm: "sqm",
  m2: "sqm",
  sqmeter: "sqm",
  sqmeters: "sqm",
  squaremeter: "sqm",
  squaremeters: "sqm",

  l: "liter",
  lt: "liter",
  liter: "liter",
  liters: "liter",
  litre: "liter",
  litres: "liter",

  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  kilogram: "kg",
  kilograms: "kg",
};

export function applySavedPricesToItems<T extends QuoteItemWithPrice>(
  items: T[],
  priceList: PriceListItem[],
  options: ApplySavedPricesOptions = {},
): ApplySavedPricesResult<T> {
  const { onlyMissingPrice = true, fillEmptyUnit = true } = options;
  if (!Array.isArray(items) || items.length === 0) {
    return { items, matchedCount: 0 };
  }
  if (!Array.isArray(priceList) || priceList.length === 0) {
    return { items, matchedCount: 0 };
  }

  const normalizedList = normalizePriceList(priceList);
  if (normalizedList.length === 0) {
    return { items, matchedCount: 0 };
  }

  let matchedCount = 0;
  const next = items.map((item) => {
    const shouldMatch =
      !onlyMissingPrice ||
      item.price === null ||
      item.price === undefined ||
      !Number.isFinite(item.price) ||
      item.price <= 0;

    if (!shouldMatch || !item.name?.trim()) return item;

    const match = findBestMatch(item.name, item.unit, normalizedList);
    if (!match) return item;

    matchedCount += 1;
    const nextPrice = match.item.price;
    const nextUnit =
      fillEmptyUnit &&
      (!item.unit || item.unit.trim().length === 0) &&
      match.item.unit
        ? match.item.unit
        : item.unit;
    const nextLineTotal = (Number(item.qty) || 0) * nextPrice;

    return {
      ...item,
      unit: nextUnit,
      price: nextPrice,
      lineTotal: nextLineTotal,
    };
  });

  return { items: next, matchedCount };
}

export function getPriceMatchCandidates(
  name: string,
  unit: string | undefined,
  priceList: PriceListItem[],
  options: MatchCandidateOptions = {},
): PriceMatchCandidate[] {
  const { maxResults = 3, minScore = 0.5 } = options;
  if (!name?.trim()) return [];
  if (!Array.isArray(priceList) || priceList.length === 0) return [];

  const normalizedList = normalizePriceList(priceList);
  if (normalizedList.length === 0) return [];

  const query = normalizeText(name);
  if (!query) return [];
  const querySorted = sortTokens(query);
  const queryUnit = normalizeUnit(unit);

  const scored: PriceMatchCandidate[] = [];
  for (const entry of normalizedList) {
    const baseScore = scoreEntry(query, querySorted, entry.searchKeys);
    if (baseScore <= 0) continue;

    const score = clamp01(
      baseScore + getUnitScoreDelta(queryUnit, entry.normalizedUnit),
    );
    if (score < minScore) continue;
    scored.push({ item: entry, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, maxResults));
}

function normalizePriceList(items: PriceListItem[]): NormalizedPriceListItem[] {
  return items
    .filter(
      (item) =>
        item &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        typeof item.price === "number" &&
        Number.isFinite(item.price) &&
        item.price >= 0,
    )
    .map((item) => {
      const aliases = Array.isArray(item.aliases)
        ? item.aliases
            .filter((a): a is string => typeof a === "string")
            .map((a) => a.trim())
            .filter((a) => a.length > 0)
        : [];
      return {
        ...item,
        normalizedUnit: normalizeUnit(item.unit),
        searchKeys: buildSearchKeys(item.name, aliases),
      };
    })
    .filter((item) => item.searchKeys.length > 0);
}

function findBestMatch(
  name: string,
  unit: string | undefined,
  entries: NormalizedPriceListItem[],
): PriceMatchCandidate | null {
  const query = normalizeText(name);
  if (!query) return null;
  const querySorted = sortTokens(query);
  const queryUnit = normalizeUnit(unit);

  let best: PriceMatchCandidate | null = null;
  for (const entry of entries) {
    const baseScore = scoreEntry(query, querySorted, entry.searchKeys);
    if (baseScore <= 0) continue;

    const score = clamp01(
      baseScore + getUnitScoreDelta(queryUnit, entry.normalizedUnit),
    );
    if (!best || score > best.score) {
      best = { item: entry, score };
    }
  }

  if (!best || best.score < MATCH_ACCEPT_SCORE) return null;
  return best;
}

function scoreEntry(
  query: string,
  querySorted: string,
  searchKeys: string[],
): number {
  let best = 0;
  for (const key of searchKeys) {
    best = Math.max(best, scoreName(query, key));
    if (querySorted && querySorted !== query) {
      best = Math.max(best, scoreName(querySorted, key));
    }
    if (best >= 1) return 1;
  }
  return best;
}

function scoreName(query: string, candidate: string): number {
  if (!query || !candidate) return 0;
  if (query === candidate) return 1;

  if (query.includes(candidate) || candidate.includes(query)) {
    const minLen = Math.min(query.length, candidate.length);
    if (minLen >= 3) {
      const lenPenalty =
        Math.min(Math.abs(query.length - candidate.length), 10) * 0.01;
      return clamp01(0.94 - lenPenalty);
    }
  }

  const queryTokens = tokenize(query);
  const candidateTokens = tokenize(candidate);
  const common = countCommonTokens(queryTokens, candidateTokens);
  const overlap =
    Math.max(queryTokens.length, candidateTokens.length) > 0
      ? common / Math.max(queryTokens.length, candidateTokens.length)
      : 0;
  const coverage = queryTokens.length > 0 ? common / queryTokens.length : 0;
  const dice = diceCoefficient(query, candidate);

  let score = Math.max(dice * 0.9, overlap * 0.8 + coverage * 0.2);
  if (coverage === 1 && queryTokens.length > 0) {
    score = Math.max(score, 0.9);
  }
  return clamp01(score);
}

function buildSearchKeys(name: string, aliases: string[]): string[] {
  const keys = new Set<string>();

  const addCandidate = (raw: string | undefined) => {
    if (!raw) return;
    const normalized = normalizeText(raw);
    if (!normalized) return;
    keys.add(normalized);
    const sorted = sortTokens(normalized);
    if (sorted) keys.add(sorted);
    const singular = singularizeAsciiWords(normalized);
    if (singular) keys.add(singular);
  };

  addCandidate(name);
  for (const alias of aliases) {
    addCandidate(alias);
  }

  return [...keys];
}

function singularizeAsciiWords(input: string): string {
  const singularized = input
    .split(" ")
    .map((token) => {
      if (!/^[a-z]+$/.test(token)) return token;
      if (token.length <= 3) return token;
      if (token.endsWith("es")) return token.slice(0, -2);
      if (token.endsWith("s")) return token.slice(0, -1);
      return token;
    })
    .filter((token) => token.length > 0)
    .join(" ");
  return singularized !== input ? singularized : "";
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0590-\u05ff\u0600-\u06ff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUnit(unit: string | undefined | null): string | null {
  if (!unit) return null;
  const normalized = normalizeText(unit).replace(/\s+/g, "");
  if (!normalized) return null;
  return UNIT_ALIASES[normalized] ?? normalized;
}

function sortTokens(input: string): string {
  const tokens = tokenize(input);
  if (tokens.length <= 1) return tokens.join(" ");
  return [...tokens].sort().join(" ");
}

function tokenize(input: string): string[] {
  return input.split(" ").filter((token) => token.length > 0);
}

function countCommonTokens(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let common = 0;
  for (const token of a) {
    if (setB.has(token)) common += 1;
  }
  return common;
}

function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i += 1) {
    const gram = a.slice(i, i + 2);
    bigramsA.set(gram, (bigramsA.get(gram) ?? 0) + 1);
  }

  let overlap = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const gram = b.slice(i, i + 2);
    const count = bigramsA.get(gram) ?? 0;
    if (count > 0) {
      bigramsA.set(gram, count - 1);
      overlap += 1;
    }
  }

  return (2 * overlap) / (a.length - 1 + (b.length - 1));
}

function getUnitScoreDelta(
  queryUnit: string | null,
  entryUnit: string | null,
): number {
  if (!queryUnit || !entryUnit) return 0;
  if (queryUnit === entryUnit) return UNIT_MATCH_BONUS;
  return -UNIT_MISMATCH_PENALTY;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

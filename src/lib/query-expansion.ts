import OpenAI from "openai";

import { appConfig, isDevMode } from "@/lib/config";

const QUERY_EXPANSION_CACHE_TTL_MS = 5 * 60 * 1000;
const QUERY_EXPANSION_CACHE_MAX_ENTRIES = 100;
const QUERY_EXPANSION_MAX_TERMS = 12;
const QUERY_EXPANSION_MAX_TERM_LENGTH = 80;
const QUERY_EXPANSION_TIMEOUT_MS = isDevMode() ? 30 * 1000 : 4 * 1000;

const openai = new OpenAI({
  baseURL: appConfig.openaiBaseUrl,
  apiKey: appConfig.openaiApiKey || "local-llm",
});

type QueryExpansionCacheEntry = {
  terms: string[];
  expiresAt: number;
};

type QueryExpansionResponse = {
  related_terms?: unknown;
  relatedTerms?: unknown;
};

export type QueryExpansionFetcher = (
  query: string,
  languages: string[],
) => Promise<QueryExpansionResponse | null | undefined>;

const queryExpansionCache = new Map<string, QueryExpansionCacheEntry>();

function normalizeCorpusLanguages(languages: string[] | undefined): string[] {
  if (!languages?.length) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of languages) {
    const code = raw.trim().toLowerCase();
    if (!code || seen.has(code)) {
      continue;
    }
    seen.add(code);
    normalized.push(code);
  }

  return normalized.sort();
}

function buildExpansionCacheKey(query: string, languages: string[]) {
  return `${query}\u0000${languages.join(",")}`;
}

function normalizeExpansionTerm(term: string) {
  return term
    .replace(/\s+/g, " ")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim()
    .slice(0, QUERY_EXPANSION_MAX_TERM_LENGTH);
}

export function normalizeExpansionTerms(
  query: string,
  terms: unknown,
): string[] {
  if (!Array.isArray(terms)) {
    return [];
  }

  const original = query.trim().toLowerCase();
  const seen = new Set<string>();
  const normalizedTerms: string[] = [];

  for (const value of terms) {
    if (typeof value !== "string") {
      continue;
    }

    const normalized = normalizeExpansionTerm(value);
    const dedupeKey = normalized.toLowerCase();

    if (!normalized || normalized.length < 2 || dedupeKey === original) {
      continue;
    }

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    normalizedTerms.push(normalized);

    if (normalizedTerms.length >= QUERY_EXPANSION_MAX_TERMS) {
      break;
    }
  }

  return normalizedTerms;
}

function getCachedTerms(cacheKey: string, now: number) {
  const cached = queryExpansionCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= now) {
    queryExpansionCache.delete(cacheKey);
    return null;
  }

  queryExpansionCache.delete(cacheKey);
  queryExpansionCache.set(cacheKey, cached);
  return cached.terms;
}

function setCachedTerms(cacheKey: string, terms: string[], now: number) {
  queryExpansionCache.delete(cacheKey);
  queryExpansionCache.set(cacheKey, {
    terms,
    expiresAt: now + QUERY_EXPANSION_CACHE_TTL_MS,
  });

  while (queryExpansionCache.size > QUERY_EXPANSION_CACHE_MAX_ENTRIES) {
    const oldestKey = queryExpansionCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    queryExpansionCache.delete(oldestKey);
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("Query expansion timed out"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function fetchExpansionTermsFromModel(
  query: string,
  languages: string[],
): Promise<QueryExpansionResponse | null | undefined> {
  const multiLanguage = languages.length > 1;
  const languageList = languages.join(", ");

  console.log(
    `Fetching expansion terms for query: ${query}${multiLanguage ? ` (corpus languages: ${languageList})` : ""}`,
  );

  const systemCrossLanguage = multiLanguage
    ? `
- The indexed document corpus includes multiple languages (ISO 639-1 codes are given in the user message). Include equivalent and native terms in each of those languages for the concepts in the query, in addition to synonyms and related terms in the query's own language.`
    : "";

  const userCrossLanguage = multiLanguage
    ? `
The corpus contains documents in these languages (ISO 639-1): ${languageList}. Include equivalent terms in each of these languages for the user's query, in addition to synonyms in the query's own language.
`
    : "";

  const response = await openai.chat.completions.create({
    model: appConfig.ocrModel,
    messages: [
      {
        role: "system",
        content: `Return JSON only.
Schema: { "related_terms": string[] }

- Include related keywords, synonyms, alternate names, abbreviations, domain terms, and likely document vocabulary.${systemCrossLanguage}
- Keep terms concise.
- Do not include explanations or any fields other than related_terms.
- Do not repeat the user's exact query.`,
      },
      {
        role: "user",
        content: `Please enhance the user's search query by adding as many related terms as possible, to maximize the likelihood they will find their document.
<userQuery>
${query}
</userQuery>
${userCrossLanguage}
<schema>
{"related_terms": string[]}
</schema>
`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content) as QueryExpansionResponse;
  } catch {
    return null;
  }
}

export async function expandSearchQuery(
  query: string,
  options: {
    fetcher?: QueryExpansionFetcher;
    languages?: string[];
    now?: () => number;
    timeoutMs?: number;
  } = {},
): Promise<string[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const normalizedLanguages = normalizeCorpusLanguages(options.languages);
  const cacheKey = buildExpansionCacheKey(trimmedQuery, normalizedLanguages);

  const now = options.now?.() ?? Date.now();
  const cachedTerms = getCachedTerms(cacheKey, now);
  if (cachedTerms) {
    return cachedTerms;
  }

  try {
    const fetcher = options.fetcher ?? fetchExpansionTermsFromModel;
    const response = await withTimeout(
      fetcher(trimmedQuery, normalizedLanguages),
      options.timeoutMs ?? QUERY_EXPANSION_TIMEOUT_MS,
    );
    const normalizedTerms = normalizeExpansionTerms(
      trimmedQuery,
      response?.related_terms ?? response?.relatedTerms,
    );

    setCachedTerms(cacheKey, normalizedTerms, now);
    return normalizedTerms;
  } catch (error) {
    console.error("query expansion failed", error);
    return [];
  }
}

export function resetQueryExpansionCache() {
  queryExpansionCache.clear();
}

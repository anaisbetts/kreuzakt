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
) => Promise<QueryExpansionResponse | null | undefined>;

const queryExpansionCache = new Map<string, QueryExpansionCacheEntry>();

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

function getCachedTerms(query: string, now: number) {
  const cached = queryExpansionCache.get(query);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= now) {
    queryExpansionCache.delete(query);
    return null;
  }

  queryExpansionCache.delete(query);
  queryExpansionCache.set(query, cached);
  return cached.terms;
}

function setCachedTerms(query: string, terms: string[], now: number) {
  queryExpansionCache.delete(query);
  queryExpansionCache.set(query, {
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
): Promise<QueryExpansionResponse | null | undefined> {
  console.log(`Fetching expansion terms for query: ${query}`);
  const response = await openai.chat.completions.create({
    model: appConfig.ocrModel,
    messages: [
      {
        role: "system",
        content: `Return JSON only.
Schema: { "related_terms": string[] }

- Include related keywords, synonyms, alternate names, abbreviations, domain terms, and likely document vocabulary.
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
    now?: () => number;
    timeoutMs?: number;
  } = {},
): Promise<string[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const now = options.now?.() ?? Date.now();
  const cachedTerms = getCachedTerms(trimmedQuery, now);
  if (cachedTerms) {
    return cachedTerms;
  }

  try {
    const fetcher = options.fetcher ?? fetchExpansionTermsFromModel;
    const response = await withTimeout(
      fetcher(trimmedQuery),
      options.timeoutMs ?? QUERY_EXPANSION_TIMEOUT_MS,
    );
    const normalizedTerms = normalizeExpansionTerms(
      trimmedQuery,
      response?.related_terms ?? response?.relatedTerms,
    );

    setCachedTerms(trimmedQuery, normalizedTerms, now);
    return normalizedTerms;
  } catch (error) {
    console.error("query expansion failed", error);
    return [];
  }
}

export function resetQueryExpansionCache() {
  queryExpansionCache.clear();
}

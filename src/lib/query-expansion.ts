import OpenAI from "openai";

import { appConfig, isDevMode } from "@/lib/config";

const QUERY_EXPANSION_CACHE_TTL_MS = 5 * 60 * 1000;
const QUERY_EXPANSION_CACHE_MAX_ENTRIES = 100;
const QUERY_EXPANSION_MAX_TERMS = 12;
const QUERY_EXPANSION_MAX_TERM_LENGTH = 80;
const QUERY_EXPANSION_TIMEOUT_MS = isDevMode() ? 60 * 1000 : 8 * 1000;

// Anything that isn't a Unicode letter, digit, or whitespace is stripped from
// LLM-provided expansion terms. This keeps FTS5-reserved characters (quotes,
// parens, `*`, `:`, `^`, `+`, `-`, etc.) out of the MATCH query we later build.
const FTS_UNSAFE_CHARS = /[^\p{L}\p{N}\s]/gu;

// FTS5 boolean operator keywords. A bare operator word leaking into an expansion
// term would turn an innocuous phrase into FTS syntax (e.g. "risk management"
// becoming `risk (management OR manag)` after stemming), so we drop them.
const FTS_OPERATOR_WORDS = new Set(["and", "or", "not", "near"]);

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
  const stripped = term
    .replace(FTS_UNSAFE_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!stripped) {
    return "";
  }

  const safeTokens = stripped
    .split(" ")
    .filter((token) => !FTS_OPERATOR_WORDS.has(token.toLowerCase()));

  return safeTokens.join(" ").slice(0, QUERY_EXPANSION_MAX_TERM_LENGTH).trim();
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

const multiLanguagePromptTemplate = (query: string, languageList: string) => `
  You are a search query expansion assistant. Your task is to take a user's search query and generate related terms that will help them find relevant documents in a multilingual corpus. Here is the user's search query:

   <query>
   ${query}
   </query>

   Here are the languages present in the document corpus (provided as ISO 639-1 language codes):

   <languages>
   ${languageList}
   </languages>

   Your goal is to expand the search query by generating related terms that will maximize the likelihood that the user finds their document.

   Before generating your final output, work through the following steps in <expansion_process> tags:

   1. List out the core concepts in the user's query
   2. Generate related terms in the query's own language, including:
      - Synonyms
      - Related keywords
      - Alternate names
      - Abbreviations
      - Domain-specific terminology
      - Likely vocabulary that might appear in relevant documents
   3. **For EACH language code listed in the languages section**, systematically generate equivalent terms and native language terms for the concepts in the query. Go through the language list one by one - literally process each language code individually and generate terms for that specific language. First, create a checklist of all the language codes, then work through each one, marking it off as you complete it. It's OK for this section to be quite long.
   4. Review all generated terms to ensure they are concise
   5. Explicitly list any terms that exactly match the user's original query, then remove them from your final list

   Important requirements:
   - You must generate terms in ALL languages listed in the <languages> section, not just English
   - Each language in the list should be processed - generate equivalent and native terms for that language
   - Keep all terms concise (typically 1-3 words)
   - Do not include the user's exact query text in your output
   - Do not include any explanations or commentary

   After your expansion process, output your results as valid JSON matching this exact schema:
   <schema>
   {
     "related_terms": ["term1", "term2", "term3", "..."]
   }
   </schema>

   Example output structure (with generic placeholder terms):
   <schema>
   {
     "related_terms": ["synonym1", "related_concept", "abbreviation", "term_in_language2", "term_in_language3", "alternate_name", "domain_term"]
   }
   </schema>

   Your output must:
   - Be valid JSON only
   - Contain only the "related_terms" field
   - Have "related_terms" as an array of strings
   - Include no other fields, explanations, or text outside the JSON`;

const singleLanguagePromptTemplate = (query: string) => `
  You are a search query expansion assistant. Your task is to take a user's search query and generate related terms that will help them find relevant documents. Here is the user's search query:

  <query>
  ${query}
  </query>

  Your goal is to expand the search query by generating related terms that will maximize the likelihood that the user finds their document.

  Before generating your final output, work through the following steps in <expansion_process> tags:

  1. List out the core concepts in the user's query
  2. Generate related terms in the query's own language, including:
     - Synonyms
     - Related keywords
     - Alternate names
     - Abbreviations
     - Domain-specific terminology
     - Likely vocabulary that might appear in relevant documents
  3. Review all generated terms to ensure they are concise
  4. Explicitly list any terms that exactly match the user's original query, then remove them from your final list

  Important requirements:
  - Keep all terms concise (typically 1-3 words)
  - Do not include the user's exact query text in your output
  - Do not include any explanations or commentary

  After your expansion process, output your results as valid JSON matching this exact schema:
  <schema>
  {
    "related_terms": ["term1", "term2", "term3", "..."]
  }
  </schema>

  Example output structure (with generic placeholder terms):
  <schema>
  {
    "related_terms": ["synonym1", "related_concept", "abbreviation", "alternate_name", "domain_term"]
  }
  </schema>

  Your output must:
  - Be valid JSON only
  - Contain only the "related_terms" field
  - Have "related_terms" as an array of strings
  - Include no other fields, explanations, or text outside the JSON`;

async function fetchExpansionTermsFromModel(
  query: string,
  languages: string[],
): Promise<QueryExpansionResponse | null | undefined> {
  const multiLanguage = languages.length > 1;
  const languageList = languages.join(", ");

  console.log(
    `Fetching expansion terms for query: ${query}${multiLanguage ? ` (corpus languages: ${languageList})` : ""}`,
  );

  const prompt = multiLanguage
    ? multiLanguagePromptTemplate(query, languageList)
    : singleLanguagePromptTemplate(query);

  const response = await openai.chat.completions.create({
    model: appConfig.ocrModel,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
  });

  let content = response.choices[0]?.message?.content;
  if (!content) {
    return null;
  }

  content = removeThinkingFromResponse(content);

  //console.log(`Sent: ${prompt}\nReceived: ${content}`);

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

const thinkingRegex = /<think(ing)?>[\s\S]*?<\/think(ing)?>/gi;
function removeThinkingFromResponse(response: string) {
  return response.replace(thinkingRegex, "").trim();
}

import snowballFactory from "snowball-stemmers";

// Map ISO 639-1 codes to Snowball algorithm names
const LANGUAGE_MAP: Record<string, string> = {
  ar: "arabic",
  hy: "armenian",
  eu: "basque",
  ca: "catalan",
  cs: "czech",
  da: "danish",
  nl: "dutch",
  en: "english",
  fi: "finnish",
  fr: "french",
  de: "german",
  hu: "hungarian",
  ga: "irish",
  it: "italian",
  no: "norwegian",
  pt: "portuguese",
  ro: "romanian",
  ru: "russian",
  sl: "slovene",
  es: "spanish",
  sv: "swedish",
  ta: "tamil",
  tr: "turkish",
};

// Languages to use for multilingual query stemming (common European languages)
const QUERY_STEM_LANGUAGES = [
  "english",
  "french",
  "german",
  "spanish",
  "italian",
  "portuguese",
  "dutch",
  "swedish",
];

// FTS5 boolean operators are case-sensitive. If a user's query tokenizes to a
// bare operator word we must not emit it as-is — the parser would treat it as
// an operator between nothing and the next group, producing a syntax error.
const FTS_OPERATOR_WORDS = new Set(["and", "or", "not", "near"]);

// Cache stemmers to avoid recreating them on every call
const stemmerCache = new Map<
  string,
  ReturnType<typeof snowballFactory.newStemmer>
>();

function getStemmer(algorithm: string) {
  let stemmer = stemmerCache.get(algorithm);
  if (stemmer === undefined) {
    stemmer = snowballFactory.newStemmer(algorithm);
    stemmerCache.set(algorithm, stemmer);
  }
  return stemmer;
}

export function isStemSupported(language: string): boolean {
  return language in LANGUAGE_MAP;
}

// Tokenize text into lowercase words, filtering out very short tokens
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\p{P}\p{S}]+/u)
    .filter((t) => t.length > 1);
}

// Pre-stem full text for FTS indexing. Returns space-separated stemmed tokens.
export function stemText(text: string, language: string): string {
  const algorithm = LANGUAGE_MAP[language] ?? "english";
  const stemmer = getStemmer(algorithm);
  return tokenize(text)
    .map((token) => stemmer.stem(token))
    .join(" ");
}

// Stem a search query for multilingual FTS matching.
// For each query term, stems it with all common European stemmers and ORs the unique results.
// Tokens are joined with an explicit AND because FTS5 rejects implicit AND between
// parenthesized groups (e.g. "(a OR b) (c OR d)" is a syntax error).
// Example: "Rechnungen" → "(rechnungen OR rechnung)"
// Example: "insurance number" → "(insurance OR insur OR insuranc) AND (number OR numb)"
export function stemQueryMultilingual(query: string): string {
  const stemmers = QUERY_STEM_LANGUAGES.map(getStemmer);

  const terms = tokenize(query).filter((term) => !FTS_OPERATOR_WORDS.has(term));
  if (terms.length === 0) return "";

  const stemmedTerms = terms.map((term) => {
    const stems = new Set<string>();
    stems.add(term);
    for (const stemmer of stemmers) {
      stems.add(stemmer.stem(term));
    }
    const variants = [...stems].filter((v) => !FTS_OPERATOR_WORDS.has(v));
    if (variants.length === 0) return "";
    return variants.length === 1 ? variants[0] : `(${variants.join(" OR ")})`;
  });

  const joined = stemmedTerms.filter((t) => t.length > 0);
  if (joined.length === 0) return "";
  if (joined.length === 1) return joined[0];
  return joined.join(" AND ");
}

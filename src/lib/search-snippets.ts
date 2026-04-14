const DEFAULT_CONTEXT_WORDS = 18;
const START_MARKER = "[[[";
const END_MARKER = "]]]";
const ELLIPSIS = "...";

// Split text into tokens preserving whitespace/punctuation boundaries.
// Returns array of {word, start, end} for word tokens.
interface TextToken {
  word: string;
  start: number;
  end: number;
}

function tokenizeWithPositions(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null = re.exec(text);
  while (match !== null) {
    tokens.push({ word: match[0], start: match.index, end: re.lastIndex });
    match = re.exec(text);
  }
  return tokens;
}

// Check if a token matches any of the query terms.
// Exact match or token-starts-with-term (e.g. "invoices" matches term "invoice").
// Require minimum length to avoid short tokens matching long query terms.
function tokenMatchesAny(token: string, terms: string[]): boolean {
  const lower = token.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (lower.length < 2) return false;
  return terms.some((term) => lower === term || lower.startsWith(term));
}

// Extract the best snippet from originalText for the given query terms.
// Returns a string with [[[matched]]] markers and ... ellipsis.
export function extractSnippet(
  originalText: string,
  queryTerms: string[],
  contextWords = DEFAULT_CONTEXT_WORDS,
): string {
  if (!originalText || queryTerms.length === 0) {
    return originalText.slice(0, 200);
  }

  const normalizedTerms = queryTerms
    .map((t) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((t) => t.length > 1);

  const tokens = tokenizeWithPositions(originalText);
  if (tokens.length === 0) return originalText.slice(0, 200);

  // Find the window of contextWords tokens with the most query term matches
  const half = Math.floor(contextWords / 2);
  let bestWindowStart = 0;
  let bestScore = -1;

  for (let i = 0; i < tokens.length; i++) {
    const windowStart = Math.max(0, i - half);
    const windowEnd = Math.min(tokens.length - 1, i + half);
    let score = 0;
    const seen = new Set<string>();
    for (let j = windowStart; j <= windowEnd; j++) {
      if (tokenMatchesAny(tokens[j].word, normalizedTerms)) {
        const key = tokens[j].word.toLowerCase();
        if (!seen.has(key)) {
          score++;
          seen.add(key);
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestWindowStart = windowStart;
    }
  }

  if (bestScore === 0) {
    // No matches found — return beginning of text
    const end = tokens[Math.min(contextWords - 1, tokens.length - 1)].end;
    return (
      originalText.slice(0, end) +
      (tokens.length > contextWords ? ELLIPSIS : "")
    );
  }

  const windowStart = bestWindowStart;
  const windowEnd = Math.min(
    tokens.length - 1,
    bestWindowStart + contextWords - 1,
  );

  // Build the snippet with highlight markers
  const startChar = tokens[windowStart].start;
  const endChar = tokens[windowEnd].end;
  const snippetText = originalText.slice(startChar, endChar);

  // Re-tokenize the snippet slice to add markers
  const snippetTokens = tokenizeWithPositions(snippetText);
  const parts: string[] = [];
  let cursor = 0;

  for (const token of snippetTokens) {
    // Add any whitespace/punctuation before this token
    if (token.start > cursor) {
      parts.push(snippetText.slice(cursor, token.start));
    }
    if (tokenMatchesAny(token.word, normalizedTerms)) {
      parts.push(START_MARKER + token.word + END_MARKER);
    } else {
      parts.push(token.word);
    }
    cursor = token.end;
  }
  if (cursor < snippetText.length) {
    parts.push(snippetText.slice(cursor));
  }

  const prefix = windowStart > 0 ? ELLIPSIS : "";
  const suffix = windowEnd < tokens.length - 1 ? ELLIPSIS : "";
  return prefix + parts.join("") + suffix;
}

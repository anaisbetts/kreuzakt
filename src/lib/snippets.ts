export function snippetMarkersToHtml(snippet: string) {
  return snippet.replaceAll("[[[", "<mark>").replaceAll("]]]", "</mark>");
}

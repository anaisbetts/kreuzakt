import { normalizePaperlessUrl } from "./paperless-url-shared";

export function resolvePaperlessApiUrl(baseUrl: string, url: string) {
  const configuredBaseUrl = new URL(`${normalizePaperlessUrl(baseUrl)}/`);
  const resolvedUrl = new URL(url, configuredBaseUrl);

  return new URL(
    `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`,
    configuredBaseUrl,
  ).toString();
}

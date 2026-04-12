export function normalizePaperlessUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

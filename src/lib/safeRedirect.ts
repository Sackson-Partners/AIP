export function safeRedirect(
  raw: string | null | undefined,
  fallback = '/dashboard'
): string {
  if (!raw) return fallback;
  try {
    const url = new URL(raw, 'http://localhost');
    if (url.hostname !== 'localhost') return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}

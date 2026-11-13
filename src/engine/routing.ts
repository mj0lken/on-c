/**
 * Base-path-aware route helpers for `/` (landing + live tour) and `/app` (distraction-free calculator mode).
 * Works seamlessly at domain root (`http://localhost:1420/app`) and GitHub Pages subpaths (`https://mj0lken.github.io/on-c/app`).
 */

function readViteBaseUrl(): string {
  const meta = import.meta as { env?: { BASE_URL?: string } };
  return meta.env?.BASE_URL ?? '/';
}

export function normalizeBasePrefix(rawBaseUrl = readViteBaseUrl()): string {
  const trimmed = rawBaseUrl.trim();
  if (!trimmed || trimmed === '/' || trimmed === './' || trimmed === '.') {
    return '';
  }
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.replace(/\/+$/, '');
}

export function isAppRouteLocation(
  pathname: string,
  search = '',
  rawBaseUrl = readViteBaseUrl()
): boolean {
  const params = new URLSearchParams(search);
  if (params.get('mode') === 'app') {
    return true;
  }

  const basePrefix = normalizeBasePrefix(rawBaseUrl);
  const cleanPath = pathname.replace(/\/+$/, '') || '/';

  if (basePrefix && cleanPath === `${basePrefix}/app`) {
    return true;
  }
  return cleanPath === '/app';
}

export function getAppRouteHref(rawBaseUrl = readViteBaseUrl()): string {
  const basePrefix = normalizeBasePrefix(rawBaseUrl);
  return `${basePrefix}/app`;
}

export function getHomeRouteHref(rawBaseUrl = readViteBaseUrl()): string {
  const basePrefix = normalizeBasePrefix(rawBaseUrl);
  return basePrefix ? `${basePrefix}/` : '/';
}

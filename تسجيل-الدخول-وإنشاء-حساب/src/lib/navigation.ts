const AUTH_APP_DIST_SEGMENT = '/dist/';
const DEV_AUTH_PORT = '3000';
const DEV_PUBLIC_SITE_PORT = '4173';

declare global {
  interface Window {
    __RAHMA_SITE_BASE_URL__?: string;
  }
}

function normalizeBaseUrl(rawValue: string | null | undefined) {
  const value = String(rawValue || '').trim();
  if (!value) return '';

  try {
    const url = new URL(value, window.location.href);
    const href = url.toString();
    return href.endsWith('/') ? href : `${href}/`;
  } catch {
    return '';
  }
}

function normalizeRootHtmlTarget(pathname: string | null | undefined, fallback = 'company-dashboard.html') {
  const safeFallback = String(fallback || '').trim() || 'company-dashboard.html';
  const rawPath = String(pathname || '').trim();
  if (!rawPath) return safeFallback;

  const normalizedPath = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const fileName = normalizedPath.split('/').filter(Boolean).pop() || '';
  return /\.html$/i.test(fileName) ? fileName : safeFallback;
}

export function sanitizeRedirectTarget(target: string | null | undefined, fallback = 'company-dashboard.html') {
  const safeFallback = normalizeRootHtmlTarget(fallback, 'company-dashboard.html');
  const rawTarget = String(target || '').trim();
  if (!rawTarget) return safeFallback;

  try {
    const nextUrl = new URL(rawTarget, window.location.origin);
    if (nextUrl.origin !== window.location.origin) return safeFallback;
    if (!/\.html$/i.test(nextUrl.pathname)) return safeFallback;
    const pathname = normalizeRootHtmlTarget(nextUrl.pathname, safeFallback);
    return `${pathname}${nextUrl.search}${nextUrl.hash}`;
  } catch {
    return safeFallback;
  }
}

function getConfiguredSiteBaseUrl() {
  if (typeof window === 'undefined') return '';

  const runtimeValue = normalizeBaseUrl(window.__RAHMA_SITE_BASE_URL__);
  if (runtimeValue) return runtimeValue;

  const envValue = normalizeBaseUrl(import.meta.env.VITE_SITE_BASE_URL);
  if (envValue) return envValue;

  return '';
}

function isLocalLikeHostname(hostname: string) {
  const value = String(hostname || '').trim().toLowerCase();
  if (!value) return false;
  if (value === 'localhost' || value === '127.0.0.1' || value === '0.0.0.0') return true;
  if (value.startsWith('192.168.') || value.startsWith('10.')) return true;
  return /^172\.(1[6-9]|2\d|3[0-1])\./.test(value);
}

function getSiteBaseUrl() {
  if (typeof window === 'undefined') {
    return '/';
  }

  if (window.location.port === DEV_AUTH_PORT) {
    return `${window.location.protocol}//${window.location.hostname}:${DEV_PUBLIC_SITE_PORT}/`;
  }

  const preferLocalOrigin = isLocalLikeHostname(window.location.hostname);
  if (preferLocalOrigin) {
    return `${window.location.origin}/`;
  }

  const configuredBaseUrl = getConfiguredSiteBaseUrl();
  if (configuredBaseUrl && !preferLocalOrigin) {
    return configuredBaseUrl;
  }

  const currentPath = window.location.pathname || '/';
  if (currentPath.includes('/company-auth/') || currentPath.endsWith('/company-auth')) {
    return `${window.location.origin}/`;
  }

  if (currentPath.lastIndexOf(AUTH_APP_DIST_SEGMENT) >= 0) {
    return `${window.location.origin}/`;
  }

  return `${window.location.origin}/`;
}

export function buildSiteUrl(target: string | null | undefined, fallback = 'index.html') {
  const safeTarget = sanitizeRedirectTarget(target, fallback);
  return new URL(safeTarget, getSiteBaseUrl()).toString();
}

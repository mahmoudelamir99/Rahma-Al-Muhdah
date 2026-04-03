import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const options = {
  root: process.cwd(),
  port: 4173,
  spaFallback: false,
};

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--root') {
    options.root = args[index + 1] || options.root;
    index += 1;
    continue;
  }
  if (arg === '--port') {
    options.port = Number(args[index + 1] || options.port);
    index += 1;
    continue;
  }
  if (arg === '--spa-fallback') {
    options.spaFallback = true;
  }
}

const root = path.resolve(options.root);
const runtimeSyncPath = '/__runtime-sync__/public-runtime';

const LEGACY_DEMO_NAME_MARKERS = ['اختبار', 'tiba store', 'creative trips', 'شركة النور', 'شركة البيان', 'demo'];

function normalizeRuntimeText(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isLegacyDemoRuntimeName(value = '') {
  const normalized = normalizeRuntimeText(value);
  return (
    LEGACY_DEMO_NAME_MARKERS.some((marker) => normalized.includes(marker)) ||
    (/اختبار/.test(normalized) && /\d{6,}/.test(normalized))
  );
}

function sanitizeRuntimePayload(payload = {}) {
  const nextPayload = payload && typeof payload === 'object' ? { ...payload } : {};

  if (Array.isArray(nextPayload.companies)) {
    nextPayload.companies = nextPayload.companies.filter(
      (company) => !isLegacyDemoRuntimeName(company?.name) && !isLegacyDemoRuntimeName(company?.id),
    );
  }

  if (Array.isArray(nextPayload.jobs)) {
    nextPayload.jobs = nextPayload.jobs.filter(
      (job) =>
        !isLegacyDemoRuntimeName(job?.companyName) &&
        !isLegacyDemoRuntimeName(job?.title) &&
        !isLegacyDemoRuntimeName(job?.id),
    );
  }

  return nextPayload;
}

function getRuntimeCompanyKey(company = {}) {
  return normalizeRuntimeText(company?.name || company?.id || '');
}

function getRuntimeJobKey(job = {}) {
  return normalizeRuntimeText(`${job?.title || ''}::${job?.companyName || ''}::${job?.location || ''}`);
}

function getRuntimeApplicationKey(application = {}) {
  return normalizeRuntimeText(application?.requestId || application?.id || '');
}

function mergeRuntimeCollections(currentItems = [], incomingItems = [], keyGetter) {
  const merged = new Map();

  [...currentItems, ...incomingItems].forEach((item) => {
    const key = keyGetter(item);
    if (!key) return;

    const existing = merged.get(key) || {};
    merged.set(key, { ...existing, ...item });
  });

  return Array.from(merged.values());
}

function mergeRuntimePayload(currentPayload = {}, incomingPayload = {}) {
  const sanitizedCurrent = sanitizeRuntimePayload(currentPayload);
  const sanitizedIncoming = sanitizeRuntimePayload(incomingPayload);

  return sanitizeRuntimePayload({
    ...sanitizedCurrent,
    ...sanitizedIncoming,
    settings: {
      ...(sanitizedCurrent.settings || {}),
      ...(sanitizedIncoming.settings || {}),
    },
    content: {
      ...(sanitizedCurrent.content || {}),
      ...(sanitizedIncoming.content || {}),
    },
    companies: mergeRuntimeCollections(
      Array.isArray(sanitizedCurrent.companies) ? sanitizedCurrent.companies : [],
      Array.isArray(sanitizedIncoming.companies) ? sanitizedIncoming.companies : [],
      getRuntimeCompanyKey,
    ),
    jobs: mergeRuntimeCollections(
      Array.isArray(sanitizedCurrent.jobs) ? sanitizedCurrent.jobs : [],
      Array.isArray(sanitizedIncoming.jobs) ? sanitizedIncoming.jobs : [],
      getRuntimeJobKey,
    ),
    applications: mergeRuntimeCollections(
      Array.isArray(sanitizedCurrent.applications) ? sanitizedCurrent.applications : [],
      Array.isArray(sanitizedIncoming.applications) ? sanitizedIncoming.applications : [],
      getRuntimeApplicationKey,
    ),
  });
}

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.mjs', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function getContentType(filePath) {
  return mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
}

function isInsideRoot(candidatePath) {
  const relative = path.relative(root, candidatePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) || candidatePath === root;
}

function resolvePath(requestUrl) {
  const url = new URL(requestUrl, 'http://127.0.0.1');
  let requestPath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  requestPath = requestPath.replaceAll('/', path.sep);

  if (!requestPath) {
    return path.join(root, 'index.html');
  }

  const candidate = path.resolve(root, requestPath);
  if (!isInsideRoot(candidate)) {
    return null;
  }

  if (existsSync(candidate)) {
    const stats = statSync(candidate);
    if (stats.isDirectory()) {
      const indexFile = path.join(candidate, 'index.html');
      if (existsSync(indexFile)) {
        return indexFile;
      }
    }
    if (stats.isFile()) {
      return candidate;
    }
  }

  if (!path.extname(candidate)) {
    const htmlCandidate = `${candidate}.html`;
    if (existsSync(htmlCandidate)) {
      return htmlCandidate;
    }
  }

  if (options.spaFallback) {
    const indexFile = path.join(root, 'index.html');
    if (existsSync(indexFile)) {
      return indexFile;
    }
  }

  return null;
}

function sendCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Max-Age', '86400');
}

function sendNoCacheHeaders(response) {
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Expires', '0');
  response.setHeader('Surrogate-Control', 'no-store');
}

async function handleRuntimeSync(request, response) {
  if (request.method === 'OPTIONS') {
    sendCorsHeaders(response);
    sendNoCacheHeaders(response);
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== 'POST') {
    sendCorsHeaders(response);
    sendNoCacheHeaders(response);
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  let payload = {};
  try {
    const raw = Buffer.concat(chunks).toString('utf8') || '{}';
    payload = JSON.parse(raw);
  } catch {
    sendCorsHeaders(response);
    sendNoCacheHeaders(response);
    const body = JSON.stringify({ ok: false });
    response.writeHead(400, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
    });
    response.end(body);
    return;
  }

  const targetPath = path.join(root, 'admin-runtime.shared.json');
  let currentPayload = {};
  try {
    currentPayload = JSON.parse((await readFile(targetPath, 'utf8')) || '{}');
  } catch {
    currentPayload = {};
  }

  const mergedPayload = mergeRuntimePayload(currentPayload, payload);
  await writeFile(targetPath, `${JSON.stringify(mergedPayload, null, 2)}\n`, 'utf8');

  const body = JSON.stringify({ ok: true });
  sendCorsHeaders(response);
  sendNoCacheHeaders(response);
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  response.end(body);
}

const server = createServer(async (request, response) => {
  try {
    if (!request.url) {
      sendNoCacheHeaders(response);
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Bad request');
      return;
    }

    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (pathname === runtimeSyncPath) {
      await handleRuntimeSync(request, response);
      return;
    }

    const filePath = resolvePath(request.url);
    if (!filePath || !existsSync(filePath)) {
      sendNoCacheHeaders(response);
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    let body = await readFile(filePath);
    if (path.basename(filePath).toLowerCase() === 'admin-runtime.shared.json') {
      try {
        const parsedBody = JSON.parse(body.toString('utf8') || '{}');
        const sanitizedBody = sanitizeRuntimePayload(parsedBody);
        const serializedBody = `${JSON.stringify(sanitizedBody, null, 2)}\n`;
        if (serializedBody !== body.toString('utf8')) {
          await writeFile(filePath, serializedBody, 'utf8');
          body = Buffer.from(serializedBody, 'utf8');
        }
      } catch {
        body = Buffer.from('{\n  "settings": {},\n  "content": {},\n  "jobs": [],\n  "companies": [],\n  "applications": []\n}\n', 'utf8');
      }
    }

    sendNoCacheHeaders(response);
    response.writeHead(200, {
      'Content-Type': getContentType(filePath),
      'Content-Length': body.length,
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    response.end(body);
  } catch (error) {
    if (!response.headersSent) {
      sendNoCacheHeaders(response);
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Server error');
      return;
    }

    response.destroy();
  }
});

server.listen(options.port, '0.0.0.0', () => {
  console.log(`Serving ${root} on port ${options.port}`);
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

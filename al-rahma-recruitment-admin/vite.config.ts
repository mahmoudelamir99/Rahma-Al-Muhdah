import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs/promises';
import path from 'path';
import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';

const SHARED_RUNTIME_FILE = path.resolve(__dirname, '..', 'admin-runtime.shared.json');
type RuntimeRecord = Record<string, unknown>;
type RuntimePayload = Record<string, unknown> & {
  companies?: RuntimeRecord[];
  jobs?: RuntimeRecord[];
  applications?: RuntimeRecord[];
};

const LEGACY_DEMO_NAME_MARKERS = ['اختبار', 'tiba store', 'creative trips', 'شركة النور', 'شركة البيان', 'demo'];

function normalizeRuntimeText(value: unknown = '') {
  return String(value || '').trim().toLowerCase();
}

function isLegacyDemoRuntimeName(value: unknown = '') {
  const normalized = normalizeRuntimeText(value);
  return (
    LEGACY_DEMO_NAME_MARKERS.some((marker) => normalized.includes(marker)) ||
    (/اختبار/.test(normalized) && /\d{6,}/.test(normalized))
  );
}

function sanitizeRuntimePayload(payload: unknown): RuntimePayload {
  const nextPayload: RuntimePayload = payload && typeof payload === 'object' ? { ...(payload as RuntimePayload) } : {};

  if (Array.isArray(nextPayload.companies)) {
    nextPayload.companies = nextPayload.companies.filter(
      (company: RuntimeRecord) => !isLegacyDemoRuntimeName(company.name) && !isLegacyDemoRuntimeName(company.id),
    );
  }

  if (Array.isArray(nextPayload.jobs)) {
    nextPayload.jobs = nextPayload.jobs.filter(
      (job: RuntimeRecord) =>
        !isLegacyDemoRuntimeName(job.companyName) &&
        !isLegacyDemoRuntimeName(job.title) &&
        !isLegacyDemoRuntimeName(job.id),
    );
  }

  return nextPayload;
}

function getRuntimeCompanyKey(company: RuntimeRecord = {}) {
  return normalizeRuntimeText(company.name || company.id || '');
}

function getRuntimeJobKey(job: RuntimeRecord = {}) {
  return normalizeRuntimeText(`${job.title || ''}::${job.companyName || ''}::${job.location || ''}`);
}

function getRuntimeApplicationKey(application: RuntimeRecord = {}) {
  return normalizeRuntimeText(application.requestId || application.id || '');
}

function mergeRuntimeCollections(currentItems: RuntimeRecord[] = [], incomingItems: RuntimeRecord[] = [], keyGetter: (item: RuntimeRecord) => string) {
  const merged = new Map<string, RuntimeRecord>();

  [...currentItems, ...incomingItems].forEach((item) => {
    const key = keyGetter(item);
    if (!key) return;

    const existing = merged.get(key) || {};
    merged.set(key, { ...existing, ...item });
  });

  return Array.from(merged.values());
}

function mergeRuntimePayload(currentPayload: unknown, incomingPayload: unknown): RuntimePayload {
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

function sharedRuntimeSyncPlugin(): Plugin {
  return {
    name: 'shared-runtime-sync',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/__runtime-sync__/public-runtime')) {
          next();
          return;
        }

        if (req.method === 'GET') {
          try {
            const body = await fs.readFile(SHARED_RUNTIME_FILE, 'utf8');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(body);
          } catch {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end('{}');
          }
          return;
        }

        if (req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          req.on('end', async () => {
            try {
              const rawBody = Buffer.concat(chunks).toString('utf8') || '{}';
              const parsedBody = JSON.parse(rawBody);
              let currentBody: unknown = {};
              try {
                currentBody = JSON.parse(await fs.readFile(SHARED_RUNTIME_FILE, 'utf8'));
              } catch {
                currentBody = {};
              }

              const mergedBody = mergeRuntimePayload(currentBody, parsedBody);
              await fs.writeFile(SHARED_RUNTIME_FILE, `${JSON.stringify(mergedBody, null, 2)}\n`, 'utf8');
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ ok: true }));
            } catch {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ ok: false }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.end();
      });
    },
  };
}

function legacyChunkCompatPlugin(): Plugin {
  const legacyChunkAliases = [
    { legacyFile: 'index-C_m7lYDo.js', prefix: 'index' },
    { legacyFile: 'Applications-voh6gsHZ.js', prefix: 'Applications' },
    { legacyFile: 'Companies-T5k0wx7p.js', prefix: 'Companies' },
    { legacyFile: 'Dashboard-BojN3-0T.js', prefix: 'Dashboard' },
    { legacyFile: 'Jobs-YH0KcNes.js', prefix: 'Jobs' },
    { legacyFile: 'Login-Bugrondf.js', prefix: 'Login' },
    { legacyFile: 'Messages-DJqs-plJ.js', prefix: 'Messages' },
    { legacyFile: 'Notifications-DAzr-9Jd.js', prefix: 'Notifications' },
    { legacyFile: 'Reports-BP-JNeTX.js', prefix: 'Reports' },
    { legacyFile: 'Settings-CooK1A16.js', prefix: 'Settings' },
  ] as const;

  const legacyFileSet = new Set(legacyChunkAliases.map((item) => item.legacyFile));

  function resolveModernChunk(files: string[], prefix: string) {
    return (
      files.find(
        (fileName) =>
          fileName.startsWith(`${prefix}-`) &&
          fileName.endsWith('.js') &&
          !legacyFileSet.has(fileName),
      ) || null
    );
  }

  return {
    name: 'legacy-chunk-compat',
    apply: 'build',
    async closeBundle() {
      const distAssetsPath = path.resolve(__dirname, 'dist', 'assets');
      let distAssetFiles: string[] = [];
      try {
        distAssetFiles = await fs.readdir(distAssetsPath);
      } catch {
        // Vercel can finish vite build without emitting legacy assets path in some runs.
        // Skip bridge generation instead of failing the whole deployment.
        return;
      }

      for (const { legacyFile, prefix } of legacyChunkAliases) {
        const modernFile = resolveModernChunk(distAssetFiles, prefix);
        if (!modernFile) continue;

        const targetPath = path.join(distAssetsPath, legacyFile);
        const bridgeCode = legacyFile.startsWith('index-')
          ? `import './${modernFile}';\n`
          : `export { default } from './${modernFile}';\n`;

        await fs.writeFile(targetPath, bridgeCode, 'utf8');
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    plugins: [react(), tailwindcss(), sharedRuntimeSyncPlugin(), legacyChunkCompatPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify. File watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('recharts')) return 'charts';
            if (id.includes('firebase')) return 'firebase';
            if (id.includes('framer-motion') || id.includes('motion')) return 'motion';
            return 'vendor';
          },
        },
      },
    },
  };
});

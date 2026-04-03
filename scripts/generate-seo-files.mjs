import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const RUNTIME_PATH = path.join(ROOT_DIR, 'admin-runtime.shared.json');
const SITEMAP_PATH = path.join(ROOT_DIR, 'sitemap.xml');
const ROBOTS_PATH = path.join(ROOT_DIR, 'robots.txt');

const rawBaseUrl = String(process.env.SITE_BASE_URL || process.argv[2] || '').trim();

if (!rawBaseUrl) {
  console.error('Usage: SITE_BASE_URL=https://example.com node scripts/generate-seo-files.mjs');
  process.exit(1);
}

let baseUrl;
try {
  baseUrl = new URL(rawBaseUrl.endsWith('/') ? rawBaseUrl : `${rawBaseUrl}/`);
} catch {
  console.error(`Invalid SITE_BASE_URL: ${rawBaseUrl}`);
  process.exit(1);
}

const runtime = JSON.parse(fs.readFileSync(RUNTIME_PATH, 'utf8'));
const jobs = Array.isArray(runtime.jobs) ? runtime.jobs : [];
const companies = Array.isArray(runtime.companies) ? runtime.companies : [];

const isApproved = (entry) => String(entry?.status || '').trim().toLowerCase() === 'approved' && !entry?.deletedAt;
const escapeXml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const pageUrls = [
  ['index.html', 'weekly', '1.0'],
  ['jobs.html', 'daily', '0.9'],
  ['companies.html', 'daily', '0.9'],
  ['about.html', 'monthly', '0.5'],
  ['contact.html', 'monthly', '0.5'],
  ['track-application.html', 'monthly', '0.5'],
  ['privacy.html', 'yearly', '0.2'],
  ['terms.html', 'yearly', '0.2'],
];

const detailUrls = [
  ...jobs.filter(isApproved).map((job) => [
    `job-details.html?id=${encodeURIComponent(String(job.id || '').trim())}`,
    'weekly',
    '0.8',
  ]),
  ...companies.filter(isApproved).map((company) => [
    `company-details.html?id=${encodeURIComponent(String(company.id || '').trim())}`,
    'weekly',
    '0.8',
  ]),
];

const urls = [...pageUrls, ...detailUrls]
  .filter(([relativePath]) => Boolean(relativePath))
  .map(([relativePath, changefreq, priority]) => ({
    url: new URL(relativePath, baseUrl).toString(),
    changefreq,
    priority,
  }));

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (entry) => `  <url>
    <loc>${escapeXml(entry.url)}</loc>
    <changefreq>${escapeXml(entry.changefreq)}</changefreq>
    <priority>${escapeXml(entry.priority)}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;

const robots = `User-agent: *
Allow: /

Disallow: /admin-login.html
Disallow: /admin-panel.html
Disallow: /portal/
Disallow: /company-dashboard.html
Disallow: /messages.html
Disallow: /تسجيل-الدخول-وإنشاء-حساب/
Disallow: /تسجيل-الدخول-وإنشاء-حساب/dist/
Disallow: /al-rahma-recruitment-admin/
Disallow: /al-rahma-recruitment-admin/dist/

Sitemap: ${new URL('sitemap.xml', baseUrl).toString()}
`;

fs.writeFileSync(SITEMAP_PATH, sitemap, 'utf8');
fs.writeFileSync(ROBOTS_PATH, robots, 'utf8');

console.log(`Generated ${path.basename(SITEMAP_PATH)} and ${path.basename(ROBOTS_PATH)} for ${baseUrl.toString()}`);

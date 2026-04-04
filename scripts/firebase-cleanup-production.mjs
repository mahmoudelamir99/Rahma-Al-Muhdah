import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const KNOWN_TEST_COMPANY_NAMES = new Set(
  [
    'شركة اختبار موبايل',
    'شركة الاختبار الآلي',
    'شركة الاختبار لي',
    'شركة النور للتجارة',
    'شركة البيان',
    'طيبة ستور tiba store',
    'creative trips',
    'شركة تجريبية',
  ].map((value) => normalizeArabic(value)),
);

function parseArgs(argv) {
  const options = {};
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith('--')) {
      options[key] = 'true';
      continue;
    }
    options[key] = nextValue;
    index += 1;
  }
  return options;
}

function readFirebaseConfig() {
  const configPath = path.join(ROOT_DIR, 'firebase-site-config.js');
  const source = fs.readFileSync(configPath, 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: configPath });
  const config = context.window.__RAHMA_FIREBASE_CONFIG__;
  if (!config?.apiKey || !config?.projectId) {
    throw new Error('Could not read firebase-site-config.js');
  }
  return config;
}

function normalizeArabic(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\u064b-\u065f]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fromFirestoreValue(value) {
  if (!value || typeof value !== 'object') return value;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) {
    return Array.isArray(value.arrayValue?.values) ? value.arrayValue.values.map(fromFirestoreValue) : [];
  }
  if ('mapValue' in value) {
    return fromFirestoreFields(value.mapValue?.fields || {});
  }
  return value;
}

function fromFirestoreFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, fromFirestoreValue(value)]));
}

async function authRequest(firebaseConfig, endpoint, body) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Auth request failed for ${endpoint}`);
  }
  return payload;
}

async function firestoreRequest(firebaseConfig, method, documentPath, { idToken } = {}) {
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${documentPath}`;
  const response = await fetch(url, {
    method,
    headers: {
      ...(idToken ? { authorization: `Bearer ${idToken}` } : {}),
    },
  });

  if (response.status === 404) {
    return { status: 404, data: null };
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.error?.message || `Firestore ${method} failed for ${documentPath}`);
  }

  return { status: response.status, data };
}

async function listCollection(firebaseConfig, collectionPath, idToken) {
  const suffix = collectionPath.includes('?') ? '&' : '?';
  const response = await firestoreRequest(
    firebaseConfig,
    'GET',
    `${collectionPath}${suffix}pageSize=250`,
    { idToken },
  );
  return Array.isArray(response.data?.documents)
    ? response.data.documents.map((doc) => ({
        name: doc.name,
        id: doc.name.split('/').pop(),
        data: fromFirestoreFields(doc.fields || {}),
      }))
    : [];
}

async function deleteDocument(firebaseConfig, documentPath, idToken) {
  return firestoreRequest(firebaseConfig, 'DELETE', documentPath, { idToken });
}

function isDummyCompany(entry) {
  const id = normalizeArabic(entry.id || '');
  const name = normalizeArabic(entry.data?.name || '');
  const email = String(entry.data?.email || '').trim().toLowerCase();
  const website = String(entry.data?.website || '').trim().toLowerCase();

  return (
    !name ||
    name.includes('اختبار') ||
    name.includes('تجريبيه') ||
    KNOWN_TEST_COMPANY_NAMES.has(name) ||
    id.includes('e2e') ||
    id.includes('test') ||
    email.includes('example.com') ||
    email.includes('qa.company.') ||
    website.includes('example-company.test')
  );
}

function isDummyJob(entry, dummyCompanyIds, dummyCompanyNames) {
  const id = normalizeArabic(entry.id || '');
  const title = normalizeArabic(entry.data?.title || '');
  const companyId = String(entry.data?.companyId || '').trim();
  const companyName = normalizeArabic(entry.data?.companyName || '');
  const deletedAt = String(entry.data?.deletedAt || '').trim();

  return (
    dummyCompanyIds.has(companyId) ||
    dummyCompanyNames.has(companyName) ||
    title.includes('اختبار') ||
    id.includes('e2e') ||
    id.includes('test') ||
    (!!deletedAt && !companyId)
  );
}

function isDummyApplication(entry, dummyCompanyIds, dummyJobIds, dummyCompanyNames) {
  const id = normalizeArabic(entry.id || '');
  const companyId = String(entry.data?.companyId || '').trim();
  const jobId = String(entry.data?.jobId || '').trim();
  const companyName = normalizeArabic(entry.data?.companyName || '');
  const applicantName = normalizeArabic(entry.data?.applicantName || '');
  const applicantEmail = String(entry.data?.applicantEmail || '').trim().toLowerCase();

  return (
    dummyCompanyIds.has(companyId) ||
    dummyJobIds.has(jobId) ||
    dummyCompanyNames.has(companyName) ||
    applicantName.includes('اختبار') ||
    applicantEmail.includes('example.com') ||
    id.includes('test')
  );
}

function logList(label, rows) {
  console.log(`- ${label}: ${rows.length}`);
  rows.forEach((row) => {
    console.log(`  * ${row.id}`);
  });
}

async function main() {
  const options = parseArgs(process.argv);
  const adminEmail = String(options['admin-email'] || process.env.RAHMA_ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = String(options['admin-password'] || process.env.RAHMA_ADMIN_PASSWORD || '').trim();
  const execute = String(options.execute || 'true').toLowerCase() !== 'false';

  if (!adminEmail || !adminPassword) {
    throw new Error('Usage: node scripts/firebase-cleanup-production.mjs --admin-email <email> --admin-password <password>');
  }

  const firebaseConfig = readFirebaseConfig();
  const adminSession = await authRequest(firebaseConfig, 'accounts:signInWithPassword', {
    email: adminEmail,
    password: adminPassword,
    returnSecureToken: true,
  });
  const adminToken = adminSession.idToken;

  const [companies, jobs, applications, users] = await Promise.all([
    listCollection(firebaseConfig, 'companies', adminToken),
    listCollection(firebaseConfig, 'jobs', adminToken),
    listCollection(firebaseConfig, 'applications', adminToken),
    listCollection(firebaseConfig, 'users', adminToken),
  ]);

  const dummyCompanies = companies.filter(isDummyCompany);
  const liveCompanyIds = new Set(companies.map((entry) => entry.id));
  const dummyCompanyIds = new Set(dummyCompanies.map((entry) => entry.id));
  const dummyCompanyNames = new Set(dummyCompanies.map((entry) => normalizeArabic(entry.data?.name || '')));
  const dummyJobs = jobs.filter((entry) => isDummyJob(entry, dummyCompanyIds, dummyCompanyNames));
  const dummyJobIds = new Set(dummyJobs.map((entry) => entry.id));
  const dummyApplications = applications.filter((entry) =>
    isDummyApplication(entry, dummyCompanyIds, dummyJobIds, dummyCompanyNames),
  );
  const dummyUsers = users.filter((entry) => {
    const role = String(entry.data?.role || '').trim().toLowerCase();
    const companyId = String(entry.data?.companyId || entry.id || '').trim();
    const companyName = normalizeArabic(entry.data?.companyName || '');
    const email = String(entry.data?.email || '').trim().toLowerCase();
    return (
      role === 'company' &&
      (
        dummyCompanyIds.has(companyId) ||
        !liveCompanyIds.has(companyId) ||
        companyName.includes('اختبار') ||
        email.includes('example.com')
      )
    );
  });

  console.log('Firebase cleanup scan');
  logList('Companies', dummyCompanies);
  logList('Jobs', dummyJobs);
  logList('Applications', dummyApplications);
  logList('Users', dummyUsers);

  if (!execute) {
    console.log('Dry run only. No documents deleted.');
    return;
  }

  for (const application of dummyApplications) {
    await deleteDocument(firebaseConfig, `applications/${application.id}`, adminToken);
  }
  for (const job of dummyJobs) {
    await deleteDocument(firebaseConfig, `jobs/${job.id}`, adminToken);
  }
  for (const company of dummyCompanies) {
    await deleteDocument(firebaseConfig, `companies/${company.id}`, adminToken);
  }
  for (const user of dummyUsers) {
    await deleteDocument(firebaseConfig, `users/${user.id}`, adminToken);
  }

  console.log('Cleanup completed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

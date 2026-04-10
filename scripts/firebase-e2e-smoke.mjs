import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

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
    throw new Error('تعذر قراءة Firebase config من الملف الرئيسي.');
  }
  return config;
}

function decodeJwtPayload(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return {};
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const normalized = payload + '='.repeat((4 - (payload.length % 4 || 4)) % 4);
  return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => toFirestoreValue(item)),
      },
    };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: toFirestoreFields(value) } };
  }
  return { stringValue: String(value) };
}

function toFirestoreFields(input) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, toFirestoreValue(value)]),
  );
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

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createRequestId() {
  return `${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`;
}

function createJobId(seed) {
  return `job-e2e-${seed}`;
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

async function firestoreRequest(firebaseConfig, method, documentPath, { idToken, body } = {}) {
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${documentPath}`;
  const response = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(idToken ? { authorization: `Bearer ${idToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
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

async function setDocument(firebaseConfig, documentPath, payload, idToken) {
  return firestoreRequest(firebaseConfig, 'PATCH', documentPath, {
    idToken,
    body: { fields: toFirestoreFields(payload) },
  });
}

async function getDocument(firebaseConfig, documentPath, idToken) {
  const response = await firestoreRequest(firebaseConfig, 'GET', documentPath, { idToken });
  return response.data?.fields ? fromFirestoreFields(response.data.fields) : null;
}

async function deleteDocument(firebaseConfig, documentPath, idToken) {
  return firestoreRequest(firebaseConfig, 'DELETE', documentPath, { idToken });
}

async function listCollection(firebaseConfig, collectionPath, idToken) {
  const suffix = collectionPath.includes('?') ? '&' : '?';
  const response = await firestoreRequest(
    firebaseConfig,
    'GET',
    `${collectionPath}${suffix}pageSize=100`,
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

async function deleteAuthUser(firebaseConfig, idToken) {
  await authRequest(firebaseConfig, 'accounts:delete', { idToken });
}

async function ensureCompanyApprovalStable(firebaseConfig, companyId, adminToken, attempts = 5) {
  let lastCompany = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const currentCompany = await getDocument(firebaseConfig, `companies/${companyId}`, adminToken);
    lastCompany = currentCompany;
    if (currentCompany?.status === 'approved' && currentCompany?.verified === true) {
      return currentCompany;
    }

    const nextCompany = {
      ...(currentCompany || {}),
      id: companyId,
      uid: currentCompany?.uid || companyId,
      ownerUid: currentCompany?.ownerUid || companyId,
      status: 'approved',
      verified: true,
      updatedAt: nowIso(),
    };
    await setDocument(firebaseConfig, `companies/${companyId}`, nextCompany, adminToken);
    await sleep(1200);
  }

  return lastCompany;
}

async function waitForPublicDocument(readDocument, { attempts = 8, delayMs = 1000 } = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const document = await readDocument();
      if (document) return document;
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      await sleep(delayMs);
    }
  }

  if (lastError) throw lastError;
  return null;
}

function logStep(message, detail) {
  if (detail === undefined) {
    console.log(`- ${message}`);
    return;
  }
  console.log(`- ${message}: ${detail}`);
}

async function main() {
  const options = parseArgs(process.argv);
  const adminEmail = String(options['admin-email'] || process.env.RAHMA_ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = String(options['admin-password'] || process.env.RAHMA_ADMIN_PASSWORD || '').trim();
  const cleanup = String(options.cleanup || 'true').toLowerCase() !== 'false';

  if (!adminEmail || !adminPassword) {
    throw new Error('Usage: node scripts/firebase-e2e-smoke.mjs --admin-email <email> --admin-password <password>');
  }

  const firebaseConfig = readFirebaseConfig();
  const uniqueSeed = Date.now().toString();
  const companyEmail = `qa.rahma.${uniqueSeed}@example.com`;
  const companyPassword = 'QaCompany@123';
  const companyName = `شركة اختبار E2E ${uniqueSeed}`;
  const companyPhone = `010${uniqueSeed.slice(-8)}`;
  const companyId = { value: '' };
  const companyToken = { value: '' };
  const jobId = createJobId(uniqueSeed);
  const requestId = createRequestId();
  let adminToken = '';

  console.log('بدء اختبار Firebase end-to-end...');

  try {
    const adminSession = await authRequest(firebaseConfig, 'accounts:signInWithPassword', {
      email: adminEmail,
      password: adminPassword,
      returnSecureToken: true,
    });
    adminToken = adminSession.idToken;

    const adminClaims = decodeJwtPayload(adminToken);
    if (!adminClaims.admin || !adminClaims.superAdmin) {
      throw new Error('حساب الأدمن سجل الدخول لكن الـ custom claims غير موجودة بالشكل المطلوب.');
    }
    logStep('تم تسجيل دخول الأدمن والتأكد من claims', `${adminClaims.email}`);

    const registeredCompany = await authRequest(firebaseConfig, 'accounts:signUp', {
      email: companyEmail,
      password: companyPassword,
      returnSecureToken: true,
    });
    companyId.value = registeredCompany.localId;
    companyToken.value = registeredCompany.idToken;
    logStep('تم تسجيل شركة تجريبية', companyEmail);

    const createdAt = nowIso();
    const companyDocument = {
      id: companyId.value,
      uid: companyId.value,
      ownerUid: companyId.value,
      name: companyName,
      sector: 'خدمات التوظيف',
      city: 'القاهرة',
      location: 'القاهرة',
      teamSize: '50',
      phone: companyPhone,
      email: companyEmail,
      website: '',
      description: 'شركة تجريبية لاختبار تدفق النظام قبل الإطلاق.',
      summary: 'شركة تجريبية لاختبار تدفق النظام قبل الإطلاق.',
      status: 'pending',
      verified: false,
      deletedAt: null,
      logoUrl: '',
      coverUrl: '',
      logoLetter: 'ا',
      createdAt,
      updatedAt: createdAt,
    };

    await setDocument(firebaseConfig, `companies/${companyId.value}`, companyDocument, companyToken.value);
    await setDocument(
      firebaseConfig,
      `users/${companyId.value}`,
      {
        uid: companyId.value,
        role: 'company',
        companyId: companyId.value,
        companyName,
        email: companyEmail,
        status: 'active',
        updatedAt: createdAt,
      },
      companyToken.value,
    );
    logStep('تم إنشاء سجل الشركة في Firestore بحالة pending');

    const companyLogin = await authRequest(firebaseConfig, 'accounts:signInWithPassword', {
      email: companyEmail,
      password: companyPassword,
      returnSecureToken: true,
    });
    companyToken.value = companyLogin.idToken;
    logStep('تم التحقق من تسجيل دخول الشركة');

    const approvedCompanyDocument = {
      ...companyDocument,
      status: 'approved',
      verified: true,
      updatedAt: nowIso(),
    };
    await setDocument(firebaseConfig, `companies/${companyId.value}`, approvedCompanyDocument, adminToken);
    const stableApprovedCompany = await ensureCompanyApprovalStable(firebaseConfig, companyId.value, adminToken);
    if (!stableApprovedCompany || stableApprovedCompany.status !== 'approved') {
      throw new Error('لم تستقر حالة الشركة على approved داخل Firebase بعد الموافقة.');
    }
    logStep('تمت موافقة الأدمن على الشركة');

    const jobCreatedAt = nowIso();
    const jobDocument = {
      id: jobId,
      ownerUid: companyId.value,
      companyId: companyId.value,
      companyName,
      title: `أخصائي موارد بشرية ${uniqueSeed.slice(-4)}`,
      location: 'القاهرة',
      type: 'دوام كامل',
      salary: 'من 12000 إلى 16000 جنيه',
      summary: 'وظيفة تجريبية لاختبار النشر والتقديم.',
      sector: 'خدمات التوظيف',
      featured: false,
      applicationEnabled: true,
      status: 'pending',
      applicantsCount: 0,
      notes: [],
      deletedAt: null,
      postedAt: jobCreatedAt,
      postedLabel: 'الآن',
      createdAt: jobCreatedAt,
      updatedAt: jobCreatedAt,
    };
    await setDocument(firebaseConfig, `jobs/${jobId}`, jobDocument, companyToken.value);
    logStep('تمت إضافة وظيفة تجريبية من حساب الشركة');

    const approvedJobDocument = {
      ...jobDocument,
      status: 'approved',
      updatedAt: nowIso(),
    };
    await setDocument(firebaseConfig, `jobs/${jobId}`, approvedJobDocument, adminToken);
    await ensureCompanyApprovalStable(firebaseConfig, companyId.value, adminToken);
    logStep('تمت موافقة الأدمن على الوظيفة');

    await sleep(1500);

    const publicCompany = await waitForPublicDocument(
      () => getDocument(firebaseConfig, `companies/${companyId.value}`, ''),
      { attempts: 8, delayMs: 1200 },
    );
    if (!publicCompany || publicCompany.status !== 'approved') {
      throw new Error('الشركة لم تظهر كبيان عام بعد الموافقة.');
    }
    logStep('تم التحقق من ظهور الشركة في القراءة العامة');

    const publicJob = await waitForPublicDocument(
      () => getDocument(firebaseConfig, `jobs/${jobId}`, ''),
      { attempts: 8, delayMs: 1200 },
    );
    if (!publicJob || publicJob.status !== 'approved') {
      throw new Error('الوظيفة لم تظهر في القراءة العامة بعد الموافقة.');
    }
    logStep('تم التحقق من ظهور الوظيفة في القراءة العامة');

    const applicationDocument = {
      id: requestId,
      requestId,
      companyId: companyId.value,
      companyName,
      jobId,
      jobTitle: approvedJobDocument.title,
      applicantName: 'متقدم اختبار',
      applicantEmail: `applicant.${uniqueSeed}@example.com`,
      applicantPhone: '01012345678',
      address: 'القاهرة',
      governorate: 'القاهرة',
      city: 'مدينة نصر',
      experience: 'خبرة متوسطة',
      experienceYears: '3',
      expectedSalary: '14000',
      educationLevel: 'بكالوريوس',
      specialization: 'إدارة أعمال',
      militaryStatus: 'أدى الخدمة',
      publicServiceCompleted: 'نعم',
      maritalStatus: 'أعزب',
      coverLetter: 'طلب تجريبي لاختبار المسار الكامل.',
      cvFileName: '',
      cvFileType: '',
      submittedAt: nowIso(),
      status: 'review',
      rejectionReason: '',
      respondedAt: null,
      forwardedTo: '',
      notes: [],
      deletedAt: null,
    };
    await setDocument(firebaseConfig, `applications/${requestId}`, applicationDocument, '');
    logStep('تم تقديم طلب تجريبي على الوظيفة', requestId);

    const adminApplications = await listCollection(firebaseConfig, 'applications', adminToken);
    if (!adminApplications.some((entry) => entry.id === requestId)) {
      throw new Error('الطلب لم يظهر للأدمن داخل Firestore.');
    }
    logStep('تم التحقق من ظهور الطلب في لوحة الأدمن');

    const acceptedApplicationDocument = {
      ...applicationDocument,
      status: 'accepted',
      respondedAt: nowIso(),
      notes: [
        {
          id: `note-${uniqueSeed}`,
          body: 'تمت مراجعة الطلب واعتماده في اختبار end-to-end.',
          createdAt: nowIso(),
          authorName: 'Super Admin',
        },
      ],
    };
    await setDocument(firebaseConfig, `applications/${requestId}`, acceptedApplicationDocument, adminToken);
    logStep('تم تحديث حالة الطلب إلى accepted من الأدمن');

    const trackedApplication = await waitForPublicDocument(
      () => getDocument(firebaseConfig, `applications/${requestId}`, ''),
      { attempts: 8, delayMs: 1200 },
    );
    if (!trackedApplication || trackedApplication.status !== 'accepted') {
      throw new Error('التتبع العام لم يعكس حالة الطلب النهائية.');
    }
    logStep('تم التحقق من التتبع العام للطلب بعد التحديث');

    console.log('\nنجح اختبار end-to-end بالكامل.');
    console.log(
      JSON.stringify(
        {
          company: {
            id: companyId.value,
            email: companyEmail,
            name: companyName,
          },
          job: {
            id: jobId,
            title: approvedJobDocument.title,
          },
          application: {
            requestId,
            status: trackedApplication.status,
          },
          cleanup,
        },
        null,
        2,
      ),
    );
  } finally {
    if (cleanup) {
      if (!adminToken) {
        try {
          const adminSession = await authRequest(firebaseConfig, 'accounts:signInWithPassword', {
            email: adminEmail,
            password: adminPassword,
            returnSecureToken: true,
          });
          adminToken = adminSession.idToken;
        } catch {
          // Ignore cleanup re-auth failures.
        }
      }

      try {
        if (adminToken) await deleteDocument(firebaseConfig, `applications/${requestId}`, adminToken);
      } catch {}
      try {
        if (adminToken) await deleteDocument(firebaseConfig, `jobs/${jobId}`, adminToken);
      } catch {}
      try {
        if (adminToken && companyId.value) await deleteDocument(firebaseConfig, `companies/${companyId.value}`, adminToken);
      } catch {}
      try {
        if (adminToken && companyId.value) await deleteDocument(firebaseConfig, `users/${companyId.value}`, adminToken);
      } catch {}
      try {
        if (companyToken.value) await deleteAuthUser(firebaseConfig, companyToken.value);
      } catch {}
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

const { cert, getApp, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

function setCorsHeaders(request, response) {
  const requestOrigin = String(request.headers.origin || '').trim();
  response.setHeader('Access-Control-Allow-Origin', requestOrigin || '*');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  response.setHeader('Vary', 'Origin');
}

function normalizeText(value) {
  return String(value || '').trim();
}

function hasAdminClaims(token = {}) {
  return (
    token.superAdmin === true ||
    token.admin === true ||
    token.role === 'super-admin' ||
    token.role === 'super_admin' ||
    token.role === 'admin' ||
    token.adminRole === 'super-admin' ||
    token.adminRole === 'admin'
  );
}

function readServiceAccount() {
  const base64Value = normalizeText(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64);
  if (base64Value) {
    return JSON.parse(Buffer.from(base64Value, 'base64').toString('utf8').replace(/^\uFEFF/, ''));
  }

  const jsonValue = normalizeText(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (jsonValue) {
    return JSON.parse(jsonValue.replace(/^\uFEFF/, ''));
  }

  throw new Error('Firebase service account env is missing.');
}

function getFirebaseAdminApp() {
  if (getApps().length) {
    return getApp();
  }

  return initializeApp({
    credential: cert(readServiceAccount()),
  });
}

function respond(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

async function safeDeleteDoc(ref) {
  try {
    await ref.delete();
  } catch {
    // Ignore cleanup failures for already-missing docs.
  }
}

async function safeDeleteQueryDocs(querySnapshot) {
  const pending = [];
  querySnapshot.forEach((doc) => {
    pending.push(safeDeleteDoc(doc.ref));
  });
  await Promise.all(pending);
}

async function resolveCompanyUser(auth, db, companyId, companyEmail = '') {
  const candidateUids = new Set([companyId]);

  try {
    const companySnapshot = await db.collection('companies').doc(companyId).get();
    if (companySnapshot.exists) {
      const companyData = companySnapshot.data() || {};
      [companyData.uid, companyData.ownerUid, companyData.authUid, companyData.firebaseUid, companyData.userId].forEach(
        (value) => {
          const normalized = normalizeText(value);
          if (normalized) candidateUids.add(normalized);
        },
      );
    }
  } catch {
    // Ignore optional company lookups when the document is already deleted.
  }

  try {
    const userSnapshot = await db.collection('users').doc(companyId).get();
    if (userSnapshot.exists) {
      const userData = userSnapshot.data() || {};
      [userData.uid, userData.auth_user_id, userData.companyId, userData.company_id].forEach((value) => {
        const normalized = normalizeText(value);
        if (normalized) candidateUids.add(normalized);
      });
    }
  } catch {
    // Ignore optional user lookups when the document is already deleted.
  }

  for (const uid of candidateUids) {
    if (!uid) continue;
    try {
      return await auth.getUser(uid);
    } catch (error) {
      if (error && error.code === 'auth/user-not-found') {
        continue;
      }
      throw error;
    }
  }

  const normalizedEmail = normalizeText(companyEmail).toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  try {
    return await auth.getUserByEmail(normalizedEmail);
  } catch (error) {
    if (error && error.code === 'auth/user-not-found') {
      return null;
    }
    throw error;
  }
}

module.exports = async (request, response) => {
  setCorsHeaders(request, response);

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method !== 'DELETE') {
    respond(response, 405, {
      ok: false,
      message: 'طريقة الطلب غير مدعومة.',
    });
    return;
  }

  const authHeader = normalizeText(request.headers.authorization);
  const idToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

  if (!idToken) {
    respond(response, 401, {
      ok: false,
      message: 'تعذر التحقق من جلسة الأدمن الحالية.',
    });
    return;
  }

  let firebaseApp;
  let decodedToken;

  try {
    firebaseApp = getFirebaseAdminApp();
    decodedToken = await getAuth(firebaseApp).verifyIdToken(idToken);
  } catch {
    respond(response, 401, {
      ok: false,
      message: 'جلسة الأدمن غير صالحة أو انتهت. سجّل الدخول مرة أخرى ثم أعد المحاولة.',
    });
    return;
  }

  if (!hasAdminClaims(decodedToken || {})) {
    respond(response, 403, {
      ok: false,
      message: 'الحساب الحالي لا يملك صلاحية الحذف النهائي للشركات.',
    });
    return;
  }

  const companyId = normalizeText(request.query.companyId);
  const companyEmail = normalizeText(request.query.email).toLowerCase();
  const companyName = normalizeText(request.query.companyName);

  if (!companyId) {
    respond(response, 400, {
      ok: false,
      message: 'معرف الشركة مطلوب.',
    });
    return;
  }

  try {
    const auth = getAuth(firebaseApp);
    const db = getFirestore(firebaseApp);
    const companyUser = await resolveCompanyUser(auth, db, companyId, companyEmail);

    if (companyUser) {
      await auth.deleteUser(companyUser.uid);
    }

    await Promise.all([
      safeDeleteDoc(db.collection('companies').doc(companyId)),
      safeDeleteDoc(db.collection('users').doc(companyId)),
    ]);

    const [
      companyIdUsers,
      companyIdLegacyUsers,
      emailUsers,
      namedUsers,
      companyJobs,
      namedCompanyJobs,
      companyApplications,
      namedCompanyApplications,
      nestedCompanyApplications,
      nestedJobCompanyApplications,
    ] = await Promise.all([
      db.collection('users').where('companyId', '==', companyId).get(),
      db.collection('users').where('company_id', '==', companyId).get(),
      companyEmail ? db.collection('users').where('email', '==', companyEmail).get() : Promise.resolve(null),
      companyName ? db.collection('users').where('companyName', '==', companyName).get() : Promise.resolve(null),
      db.collection('jobs').where('companyId', '==', companyId).get(),
      companyName ? db.collection('jobs').where('companyName', '==', companyName).get() : Promise.resolve(null),
      db.collection('applications').where('companyId', '==', companyId).get(),
      companyName ? db.collection('applications').where('companyName', '==', companyName).get() : Promise.resolve(null),
      companyName ? db.collection('applications').where('company.name', '==', companyName).get() : Promise.resolve(null),
      companyName ? db.collection('applications').where('job.jobCompany', '==', companyName).get() : Promise.resolve(null),
    ]);

    await Promise.all([
      safeDeleteQueryDocs(companyIdUsers),
      safeDeleteQueryDocs(companyIdLegacyUsers),
      emailUsers ? safeDeleteQueryDocs(emailUsers) : Promise.resolve(),
      namedUsers ? safeDeleteQueryDocs(namedUsers) : Promise.resolve(),
      safeDeleteQueryDocs(companyJobs),
      namedCompanyJobs ? safeDeleteQueryDocs(namedCompanyJobs) : Promise.resolve(),
      safeDeleteQueryDocs(companyApplications),
      namedCompanyApplications ? safeDeleteQueryDocs(namedCompanyApplications) : Promise.resolve(),
      nestedCompanyApplications ? safeDeleteQueryDocs(nestedCompanyApplications) : Promise.resolve(),
      nestedJobCompanyApplications ? safeDeleteQueryDocs(nestedJobCompanyApplications) : Promise.resolve(),
    ]);

    respond(response, 200, {
      ok: true,
      message: 'تم حذف الشركة نهائيًا من Auth وFirestore وكل السجلات المرتبطة بها.',
      companyId,
      userDeleted: Boolean(companyUser),
    });
  } catch (error) {
    respond(response, 500, {
      ok: false,
      message: 'تعذر حذف الشركة نهائيًا الآن. حاول مرة أخرى بعد قليل.',
      code: normalizeText(error && error.code) || undefined,
    });
  }
};

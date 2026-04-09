const { cert, getApp, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

function setCorsHeaders(request, response) {
  const requestOrigin = String(request.headers.origin || '').trim();
  response.setHeader('Access-Control-Allow-Origin', requestOrigin || '*');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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

function isAllowedPassword(value) {
  return typeof value === 'string' && value.trim().length >= 8 && value.trim().length <= 128;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim().toLowerCase());
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

async function resolveCompanyUser(auth, companyId, companyData = {}, companyEmail = '') {
  const candidateUids = [
    companyData.uid,
    companyData.ownerUid,
    companyData.authUid,
    companyData.firebaseUid,
    companyData.userId,
    companyId,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  for (const uid of [...new Set(candidateUids)]) {
    try {
      return await auth.getUser(uid);
    } catch (error) {
      if (error && error.code === 'auth/user-not-found') {
        continue;
      }
      throw error;
    }
  }

  if (companyEmail) {
    try {
      return await auth.getUserByEmail(companyEmail);
    } catch (error) {
      if (error && error.code === 'auth/user-not-found') {
        return null;
      }
      throw error;
    }
  }

  return null;
}

function respond(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

module.exports = async (request, response) => {
  setCorsHeaders(request, response);

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method !== 'POST') {
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
  } catch (error) {
    respond(response, 401, {
      ok: false,
      message: 'جلسة الأدمن غير صالحة أو انتهت. سجّل الدخول مرة أخرى ثم أعد المحاولة.',
    });
    return;
  }

  if (!hasAdminClaims(decodedToken || {})) {
    respond(response, 403, {
      ok: false,
      message: 'الحساب الحالي لا يملك صلاحية إدارة كلمات مرور الشركات.',
    });
    return;
  }

  const body = request.body && typeof request.body === 'object' ? request.body : {};
  const companyId = normalizeText(body.companyId);
  const companyName = normalizeText(body.companyName);
  const email = normalizeText(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!companyId) {
    respond(response, 400, {
      ok: false,
      message: 'معرف الشركة مطلوب.',
    });
    return;
  }

  if (!isValidEmail(email)) {
    respond(response, 400, {
      ok: false,
      message: 'أدخل بريدًا إلكترونيًا صحيحًا للشركة أولًا.',
    });
    return;
  }

  if (!isAllowedPassword(password)) {
    respond(response, 400, {
      ok: false,
      message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.',
    });
    return;
  }

  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);
  const companyRef = db.collection('companies').doc(companyId);

  try {
    const companySnapshot = await companyRef.get();
    const companyData = companySnapshot.exists ? companySnapshot.data() || {} : {};
    const resolvedCompanyName =
      companyName ||
      normalizeText(companyData.name) ||
      normalizeText(companyData.companyName) ||
      email.split('@')[0];

    const existingUser = await resolveCompanyUser(auth, companyId, companyData, email);

    if (existingUser && existingUser.uid !== companyId) {
      respond(response, 409, {
        ok: false,
        message: 'هذا البريد مرتبط بحساب دخول آخر لا يطابق ملف الشركة الحالي. غيّر البريد أو راجع الربط أولًا.',
      });
      return;
    }

    let action = 'updated';

    if (existingUser) {
      await auth.updateUser(companyId, {
        email,
        password,
        displayName: resolvedCompanyName,
        disabled: false,
      });
    } else {
      await auth.createUser({
        uid: companyId,
        email,
        password,
        displayName: resolvedCompanyName,
        disabled: false,
      });
      action = 'created';
    }

    const now = new Date().toISOString();
    await companyRef.set(
      {
        id: companyId,
        uid: companyId,
        ownerUid: companyId,
        authUid: companyId,
        firebaseUid: companyId,
        userId: companyId,
        name: resolvedCompanyName,
        email,
        updatedAt: now,
      },
      { merge: true },
    );

    await db.collection('users').doc(companyId).set(
      {
        uid: companyId,
        auth_user_id: companyId,
        company_id: companyId,
        role: 'company',
        email,
        display_name: resolvedCompanyName,
        updatedAt: now,
      },
      { merge: true },
    );

    respond(response, 200, {
      ok: true,
      action,
      message:
        action === 'created'
          ? 'تم إنشاء دخول الشركة وتعيين كلمة المرور بنجاح.'
          : 'تم تحديث كلمة مرور دخول الشركة بنجاح.',
      companyId,
      email,
    });
  } catch (error) {
    const code = normalizeText(error && error.code);

    if (code === 'auth/email-already-exists') {
      respond(response, 409, {
        ok: false,
        message: 'هذا البريد الإلكتروني مستخدم بالفعل في حساب آخر.',
      });
      return;
    }

    if (code === 'auth/invalid-password') {
      respond(response, 400, {
        ok: false,
        message: 'كلمة المرور غير صالحة. استخدم 8 أحرف أو أكثر.',
      });
      return;
    }

    respond(response, 500, {
      ok: false,
      message: 'تعذر تحديث كلمة مرور الشركة الآن. حاول مرة أخرى بعد قليل.',
      code: code || undefined,
    });
  }
};

const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');

if (!admin.apps.length) {
  admin.initializeApp();
}

setGlobalOptions({
  region: 'us-central1',
  maxInstances: 10,
});

function jsonResponse(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

function normalizeText(value) {
  return String(value || '').trim();
}

function hasAdminClaims(token = {}) {
  return (
    token.superAdmin === true ||
    token.admin === true ||
    token.role === 'super-admin' ||
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

async function resolveCompanyUser(auth, companyId, companyData = {}) {
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

  const companyEmail = normalizeText(companyData.email);
  if (companyEmail) {
    return auth.getUserByEmail(companyEmail);
  }

  return null;
}

exports.adminSetCompanyPassword = onRequest({ cors: true }, async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }

  if (request.method !== 'POST') {
    jsonResponse(response, 405, {
      ok: false,
      message: 'طريقة الطلب غير مدعومة.',
    });
    return;
  }

  const authHeader = normalizeText(request.get('authorization'));
  const idToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!idToken) {
    jsonResponse(response, 401, {
      ok: false,
      message: 'بيانات اعتماد الأدمن غير موجودة.',
    });
    return;
  }

  let decodedToken = null;
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    jsonResponse(response, 401, {
      ok: false,
      message: 'جلسة الأدمن غير صالحة أو انتهت.',
    });
    return;
  }

  if (!hasAdminClaims(decodedToken || {})) {
    jsonResponse(response, 403, {
      ok: false,
      message: 'هذا الحساب لا يملك صلاحية إدارة كلمات مرور الشركات.',
    });
    return;
  }

  const body = request.body && typeof request.body === 'object' ? request.body : {};
  const companyId = normalizeText(body.companyId);
  const companyName = normalizeText(body.companyName);
  const email = normalizeText(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!companyId) {
    jsonResponse(response, 400, {
      ok: false,
      message: 'معرّف الشركة مطلوب.',
    });
    return;
  }

  if (!isValidEmail(email)) {
    jsonResponse(response, 400, {
      ok: false,
      message: 'أدخل بريدًا إلكترونيًا صحيحًا للشركة.',
    });
    return;
  }

  const auth = admin.auth();
  const db = admin.firestore();
  const companyRef = db.collection('companies').doc(companyId);
  const companySnap = await companyRef.get();
  const companyData = companySnap.exists ? companySnap.data() || {} : {};
  const resolvedCompanyName =
    companyName ||
    normalizeText(companyData.name) ||
    normalizeText(companyData.companyName) ||
    email.split('@')[0];

  let existingUser = null;
  try {
    existingUser = await resolveCompanyUser(auth, companyId, {
      ...companyData,
      email,
    });
  } catch (error) {
    jsonResponse(response, 500, {
      ok: false,
      message: 'تعذر قراءة بيانات دخول الشركة الآن.',
    });
    return;
  }

  if (!existingUser && !isAllowedPassword(password)) {
    jsonResponse(response, 400, {
      ok: false,
      message: 'أدخل كلمة مرور لا تقل عن 8 أحرف لإنشاء دخول الشركة لأول مرة.',
    });
    return;
  }

  if (existingUser && existingUser.uid !== companyId) {
    jsonResponse(response, 409, {
      ok: false,
      message: 'هذا البريد الإلكتروني مرتبط بالفعل بحساب شركة آخر داخل النظام.',
    });
    return;
  }

  try {
    let action = 'updated';

    if (existingUser) {
      const updatePayload = {
        email,
        displayName: resolvedCompanyName,
        disabled: false,
      };
      if (isAllowedPassword(password)) {
        updatePayload.password = password;
      }
      await auth.updateUser(companyId, updatePayload);
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
        sector: normalizeText(companyData.sector),
        city: normalizeText(companyData.city || companyData.location),
        location: normalizeText(companyData.location || companyData.city),
        teamSize: normalizeText(companyData.teamSize),
        phone: normalizeText(companyData.phone),
        landline: normalizeText(companyData.landline),
        address: normalizeText(companyData.address),
        website: normalizeText(companyData.website),
        socialLinks: companyData.socialLinks && typeof companyData.socialLinks === 'object' ? companyData.socialLinks : {},
        siteMode: normalizeText(companyData.siteMode) === 'landing' ? 'landing' : 'full',
        restrictionMessage: normalizeText(companyData.restrictionMessage),
        restrictionAttachmentUrl: normalizeText(companyData.restrictionAttachmentUrl) || null,
        restrictionAttachmentName: normalizeText(companyData.restrictionAttachmentName),
        description: normalizeText(companyData.description || companyData.summary),
        summary: normalizeText(companyData.summary || companyData.description),
        status: normalizeText(companyData.status) || 'pending',
        verified: companyData.verified === true,
        logoUrl: normalizeText(companyData.logoUrl || companyData.imageUrl),
        coverUrl: normalizeText(companyData.coverUrl || companyData.coverImage),
        logoLetter: normalizeText(companyData.logoLetter) || resolvedCompanyName.charAt(0) || 'ش',
        imageUrl: normalizeText(companyData.imageUrl || companyData.logoUrl) || null,
        coverImage: normalizeText(companyData.coverImage || companyData.coverUrl),
        openings: Number(companyData.openings || 0),
        notes: Array.isArray(companyData.notes) ? companyData.notes : [],
        deletedBy: companyData.deletedBy || null,
        deletionReason: normalizeText(companyData.deletionReason),
        deletedStatusSnapshot: companyData.deletedStatusSnapshot || null,
        deletedAt: companyData.deletedAt || null,
        createdAt: normalizeText(companyData.createdAt) || now,
        updatedAt: now,
      },
      { merge: true },
    );

    jsonResponse(response, 200, {
      ok: true,
      action,
      message:
        action === 'created'
          ? 'تم إنشاء حساب دخول الشركة بنجاح.'
          : isAllowedPassword(password)
            ? 'تم تحديث كلمة مرور ودخول الشركة بنجاح.'
            : 'تم تحديث بيانات دخول الشركة بنجاح.',
      companyId,
      email,
    });
  } catch (error) {
    const code = normalizeText(error && error.code);
    if (code === 'auth/email-already-exists') {
      jsonResponse(response, 409, {
        ok: false,
        message: 'هذا البريد الإلكتروني مستخدم بالفعل في حساب آخر.',
      });
      return;
    }

    if (code === 'auth/invalid-password') {
      jsonResponse(response, 400, {
        ok: false,
        message: 'كلمة المرور غير صالحة. استخدم 8 أحرف على الأقل.',
      });
      return;
    }

    jsonResponse(response, 500, {
      ok: false,
      message: 'تعذر تجهيز دخول الشركة الآن. حاول مرة أخرى بعد قليل.',
    });
  }
});

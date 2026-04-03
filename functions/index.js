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
  jsonResponse(response, 410, {
    ok: false,
    message: 'This endpoint is disabled. Use Firebase password reset instead of changing company passwords directly from admin.',
  });
});

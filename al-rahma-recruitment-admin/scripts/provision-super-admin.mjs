import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

function readServiceAccount() {
  const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!explicitPath) {
    throw new Error(
      'حدد مسار service account عبر FIREBASE_SERVICE_ACCOUNT أو GOOGLE_APPLICATION_CREDENTIALS قبل تشغيل السكربت.',
    );
  }

  const absolutePath = resolve(explicitPath);
  return JSON.parse(readFileSync(absolutePath, 'utf8'));
}

function parseArgs() {
  const [, , emailArg, passwordArg, displayNameArg] = process.argv;
  const email = String(emailArg || '').trim().toLowerCase();
  const password = String(passwordArg || '').trim();
  const displayName = String(displayNameArg || 'Super Admin').trim();

  if (!email || !password) {
    throw new Error('الاستخدام: npm run auth:provision-super-admin -- <email> <password> [displayName]');
  }

  return { email, password, displayName };
}

async function getOrCreateUser(auth, input) {
  try {
    const existingUser = await auth.getUserByEmail(input.email);
    await auth.updateUser(existingUser.uid, {
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      disabled: false,
      emailVerified: true,
    });
    return await auth.getUser(existingUser.uid);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') {
      throw error;
    }

    return auth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      disabled: false,
      emailVerified: true,
    });
  }
}

async function main() {
  const input = parseArgs();
  const serviceAccount = readServiceAccount();
  const app =
    getApps()[0] ||
    initializeApp({
      credential: cert(serviceAccount),
    });

  const auth = getAuth(app);
  const db = getFirestore(app);
  const userRecord = await getOrCreateUser(auth, input);

  await auth.setCustomUserClaims(userRecord.uid, {
    admin: true,
    superAdmin: true,
    role: 'super_admin',
    adminRole: 'super-admin',
  });

  await db.collection('users').doc(userRecord.uid).set(
    {
      uid: userRecord.uid,
      role: 'admin',
      adminRole: 'super-admin',
      displayName: input.displayName,
      email: input.email,
      status: 'active',
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log('تم تجهيز Super Admin بنجاح.');
  console.log(`uid: ${userRecord.uid}`);
  console.log(`email: ${input.email}`);
  console.log('claims: admin=true, superAdmin=true, role=super_admin, adminRole=super-admin');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

const fs = require('fs');
const path = 'site.js';
let file = fs.readFileSync(path, 'utf8');

const uploadBlockStart = file.indexOf('const uploadCompanyAssetToSupabase = async (file, session = null, kind = \'asset\') => {');
if (uploadBlockStart === -1) {
  console.error('uploadCompanyAssetToSupabase start not found');
  process.exit(1);
}
const uploadBlockEnd = file.indexOf('\n  };\n\n', uploadBlockStart);
if (uploadBlockEnd === -1) {
  console.error('uploadCompanyAssetToSupabase end not found');
  process.exit(1);
}
const uploadBlock = file.slice(uploadBlockStart, uploadBlockEnd + '\n  };\n\n'.length);
const fixedUploadBlock = `const uploadCompanyAssetToSupabase = async (file, session = null, kind = 'asset') => {
  if (!file || !session?.companyId || !hasSupabaseSiteConfig()) {
    return '';
  }

  const services = await getSupabaseSiteServices();
  if (!services) return '';

  try {
    const { client } = services;
    const safeFileName = String(file.name || \\`${kind}.bin\\`).replace(/[^\\w.-]+/g, '-');
    const filePath = \\`companies/\\${session.companyId}/\\${kind}-\\${Date.now()}-\\${safeFileName}\\`;
    const { error } = await client.storage.from(supabaseSiteConfig.storageBucket).upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || undefined,
    });

    if (error) {
      console.warn('Unable to upload company asset to Supabase Storage', error);
      return '';
    }

    const { data } = client.storage.from(supabaseSiteConfig.storageBucket).getPublicUrl(filePath);
    return data?.publicUrl || '';
  } catch (error) {
    console.warn('Unable to upload company asset to Supabase Storage', error);
    return '';
  }
};
\n`;
file = file.slice(0, uploadBlockStart) + fixedUploadBlock + file.slice(uploadBlockEnd + '\n  };\n\n'.length);

const syncStart = file.indexOf('\n    try {\n      const { db, firestoreModule } = services;');
if (syncStart === -1) {
  console.error('syncRuntimeDocumentToFirebase start pattern not found');
  process.exit(1);
}
const fixedSyncHeader = `\n  const syncRuntimeDocumentToFirebase = async (runtime = {}) => {\n    if (!hasFirebaseSiteConfig()) return false;\n    const services = await getFirebaseSiteServices();\n    if (!services) return false;\n\n    try {\n      const { db, firestoreModule } = services;`;
file = file.slice(0, syncStart) + fixedSyncHeader + file.slice(syncStart + '\n    try {\n      const { db, firestoreModule } = services;'.length);

fs.writeFileSync(path, file, 'utf8');
console.log('Patched site.js');

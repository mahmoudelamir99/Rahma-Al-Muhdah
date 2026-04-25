const fs = require('fs');
const path = 'site.js';
const file = fs.readFileSync(path, 'utf8');
const oldBlock = `  const uploadCompanyAssetToSupabase = async (file, session = null, kind = 'asset') => {
    if (!file || !session?.companyId || !hasSupabaseSiteConfig()) {
      return '';
    }

    const services = await getSupabaseSiteServices();
    if (!services) return '';

    try {
      const { client } = services;
      const safeFileName = String(file.name || \`${kind}.bin\`).replace(/[^\n      );
      const filePath = \`companies/\${session.companyId}/\${kind}-\${Date.now()}-\${safeFileName}\`;
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
`;
const newBlock = `  const uploadCompanyAssetToSupabase = async (file, session = null, kind = 'asset') => {
    if (!file || !session?.companyId || !hasSupabaseSiteConfig()) {
      return '';
    }

    const services = await getSupabaseSiteServices();
    if (!services) return '';

    try {
      const { client } = services;
      const safeFileName = String(file.name || \`${kind}.bin\`).replace(/[^\\w.-]+/g, '-');
      const filePath = \`companies/\${session.companyId}/\${kind}-\${Date.now()}-\${safeFileName}\`;
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
`;
if (!file.includes(oldBlock)) {
  console.error('Old block not found');
  process.exit(1);
}
const updated = file.replace(oldBlock, newBlock);
fs.writeFileSync(path, updated, 'utf8');
console.log('Replaced uploadCompanyAssetToSupabase block');

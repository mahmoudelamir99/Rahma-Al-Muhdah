import { getSupabaseClient, hasSupabaseConfig } from './supabase';

/** Bucket for public site images (hero background, etc.). Override with VITE_SUPABASE_SITE_ASSETS_BUCKET. */
export function getSiteAssetsBucketName() {
  return String(import.meta.env.VITE_SUPABASE_SITE_ASSETS_BUCKET || 'site_assets').trim() || 'site_assets';
}

export function hasSiteAssetsStorageConfig() {
  return hasSupabaseConfig();
}

/**
 * Upload a hero background image to Supabase Storage (public bucket).
 * Requires an authenticated Supabase session with storage policies allowing admin writes.
 */
export async function uploadSiteHeroBackgroundImage(file: File) {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('supabase_client_missing');
  }

  const bucket = getSiteAssetsBucketName();
  const safeName = String(file.name || 'image.jpg').replace(/[^\w.-]+/g, '-');
  const path = `home-hero/${Date.now()}-${safeName}`;

  const { error } = await client.storage.from(bucket).upload(path, file, {
    upsert: true,
    cacheControl: '86400',
    contentType: file.type || 'image/jpeg',
  });

  if (error) {
    throw error;
  }

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  const publicUrl = data?.publicUrl || '';
  if (!publicUrl) {
    throw new Error('public_url_missing');
  }

  return publicUrl;
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { hasRahmaSupabaseConfig, resolveRahmaSupabaseConfig, type RahmaSupabaseRuntimeConfig } from '../../../shared/supabase-config.ts';

export type AdminSupabaseConfig = RahmaSupabaseRuntimeConfig;

const envSupabaseConfig: Partial<AdminSupabaseConfig> = {
  url: import.meta.env.VITE_SUPABASE_URL?.trim() || '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '',
  siteBaseUrl: import.meta.env.VITE_SITE_BASE_URL?.trim() || '',
  adminBaseUrl: import.meta.env.VITE_ADMIN_BASE_URL?.trim() || '',
};

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseConfig() {
  return resolveRahmaSupabaseConfig(envSupabaseConfig);
}

export function hasSupabaseConfig() {
  return hasRahmaSupabaseConfig(getSupabaseConfig());
}

export function getSupabaseClient() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  if (!supabaseClient) {
    const config = getSupabaseConfig();
    supabaseClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return supabaseClient;
}

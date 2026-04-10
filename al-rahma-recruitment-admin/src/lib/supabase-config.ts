export type RahmaSupabaseRuntimeConfig = {
  url: string;
  anonKey: string;
  siteBaseUrl?: string;
  adminBaseUrl?: string;
};

declare global {
  interface Window {
    __RAHMA_SUPABASE_CONFIG__?: Partial<RahmaSupabaseRuntimeConfig>;
    __RAHMA_SITE_BASE_URL__?: string;
    __RAHMA_ADMIN_BASE_URL__?: string;
  }
}

export function resolveRahmaSupabaseConfig(
  envConfig: Partial<RahmaSupabaseRuntimeConfig> = {},
): Required<RahmaSupabaseRuntimeConfig> {
  const runtimeConfig =
    typeof window !== 'undefined' && window.__RAHMA_SUPABASE_CONFIG__ && typeof window.__RAHMA_SUPABASE_CONFIG__ === 'object'
      ? window.__RAHMA_SUPABASE_CONFIG__
      : {};

  const siteBaseUrl =
    String(envConfig.siteBaseUrl || runtimeConfig.siteBaseUrl || window?.__RAHMA_SITE_BASE_URL__ || '').trim();
  const adminBaseUrl =
    String(envConfig.adminBaseUrl || runtimeConfig.adminBaseUrl || window?.__RAHMA_ADMIN_BASE_URL__ || '').trim();

  return {
    url: String(envConfig.url || runtimeConfig.url || '').trim(),
    anonKey: String(envConfig.anonKey || runtimeConfig.anonKey || '').trim(),
    siteBaseUrl,
    adminBaseUrl,
  };
}

export function hasRahmaSupabaseConfig(config: Partial<RahmaSupabaseRuntimeConfig>) {
  return Boolean(String(config.url || '').trim() && String(config.anonKey || '').trim());
}

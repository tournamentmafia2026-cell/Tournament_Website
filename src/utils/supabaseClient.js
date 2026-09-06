import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('http://') || url.startsWith('https://');
};

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && isValidUrl(supabaseUrl)
);

if (!isSupabaseConfigured) {
  console.warn('⚠️ Supabase URL or Anon Key is missing or invalid. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your hosting environment variables.');
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export default supabase;

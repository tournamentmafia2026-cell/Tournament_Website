import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://vokbwiezpgqzccfcpndv.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZva2J3aWV6cGdxemNjZmNwbmR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MDU0NDQsImV4cCI6MjEwMzk4MTQ0NH0.TcuGiEfsav2DhaAR7VCMhrXgns5BvT4mAv-oIh6iExw';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

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


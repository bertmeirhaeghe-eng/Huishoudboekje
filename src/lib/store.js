import { demoStore } from './store-demo.js';
import { createSupabaseStore } from './store-supabase.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Zonder Supabase-gegevens draait de app in proefmodus op het toestel zelf.
export const store = url && key ? createSupabaseStore(url, key) : demoStore;

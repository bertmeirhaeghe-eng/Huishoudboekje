import { demoStore } from './store-demo.js';
import { createSupabaseStore } from './store-supabase.js';
import { SUPABASE_KEY, SUPABASE_URL } from './config.js';

const url = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_KEY;

// Zonder sleutel draait de app in proefmodus op het toestel zelf.
export const store = url && key ? createSupabaseStore(url, key) : demoStore;

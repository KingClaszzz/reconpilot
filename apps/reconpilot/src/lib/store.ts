import { localStore } from "./store-local";
import { supabaseStore } from "./store-supabase";
import type { Store } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const store: Store = url && key ? supabaseStore(url, key) : localStore();

import 'server-only';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawSupabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawSupabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const rawSupabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sanitizeAnonKey = (value?: string) => {
	if (!value) return value;
	const marker = 'C_SUPABASE_ANON_KEY=';
	const markerIndex = value.indexOf(marker);
	if (markerIndex >= 0) {
		return value.slice(0, markerIndex);
	}
	return value;
};

const supabaseUrl = rawSupabaseUrl?.trim();
const supabaseKey = sanitizeAnonKey(rawSupabaseServiceRoleKey ?? rawSupabaseAnonKey)?.trim();

let cachedClient: SupabaseClient | null = null;

export const getSupabaseClient = () => {
	if (!supabaseUrl || !supabaseKey) {
		throw new Error('Supabase environment variables are missing. Set SUPABASE_URL and SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY.');
	}
	if (!cachedClient) {
		cachedClient = createClient(supabaseUrl, supabaseKey, {
			auth: {
				autoRefreshToken: false,
				persistSession: false,
			},
		});
	}
	return cachedClient;
};

export const db = new Proxy({} as SupabaseClient, {
	get(_target, property, receiver) {
		const client = getSupabaseClient();
		const value = Reflect.get(client, property, receiver);
		return typeof value === 'function' ? value.bind(client) : value;
	},
}) as SupabaseClient;

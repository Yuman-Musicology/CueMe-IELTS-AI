import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Privileged client for DB writes — bypasses RLS. */
export function createAdminClient() {
  return createClient(url, serviceKey);
}

/** Auth-scoped client — pass the user's JWT to verify identity. */
export function createAuthClient(token: string) {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

import { createClient } from "@supabase/supabase-js";

/** Kunci rahasia (service role) hanya dipakai di server dan HANYA setelah memastikan pengguna adalah Dokter. Opsional. */
export const adminTersedia = () => !!process.env.SUPABASE_SERVICE_ROLE_KEY;

export function buatAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

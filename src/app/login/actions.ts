"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

export async function masuk(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Isi email dan kata sandi terlebih dahulu." };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email atau kata sandi belum cocok. Silakan periksa lalu coba lagi." };

  redirect("/dashboard");
}

export async function keluar() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

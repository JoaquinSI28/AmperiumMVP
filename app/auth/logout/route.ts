import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function logout(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 fuerza al browser a hacer GET sobre /login (un 307 mantendría el método POST).
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}

export const POST = logout;
export const GET = logout;

import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";

// Endpoint GET /api/me
// Devuelve el usuario autenticado (si existe) usando el access token enviado por el cliente.
export async function GET(request: Request) {
  const supabase = getSupabaseClient();

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7)
    : null;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  return NextResponse.json({ user: data.user });
}


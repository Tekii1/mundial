import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";

// --- MÉTODO POST (Guardar Campeón) ---
export async function POST(request: Request) {
  const supabase = getSupabaseClient();
  const body = await request.json();
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;

  if (!token) return NextResponse.json({ message: "No autenticado" }, { status: 401 });

  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData.user) return NextResponse.json({ message: "No autenticado" }, { status: 401 });

  const { championTeam } = body;

  // Forzamos el tipo 'any' para evitar el error de 'never'
  const { data: user } = await (supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", authData.user.id)
    .single() as any);

  if (!user) return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 });

  const { error } = await (supabase.from("tournament_predictions") as any)
    .upsert({ 
      user_id: user.id, 
      champion_team: championTeam 
    }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// --- MÉTODO GET (Recuperar Campeón) ---
export async function GET(request: Request) {
  const supabase = getSupabaseClient();
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;

  if (!token) return NextResponse.json({ message: "No token" }, { status: 401 });

  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData.user) return NextResponse.json({ message: "No user" }, { status: 401 });

  // APLICAMOS EL MISMO CAMBIO AQUÍ PARA EL GET
  const { data: user } = await (supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", authData.user.id)
    .single() as any);

  if (!user) return NextResponse.json({ championTeam: null });

  // Usamos 'as any' en la tabla tournament_predictions también
  const { data: existingPrediction, error } = await (supabase
    .from("tournament_predictions") as any)
    .select("champion_team")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ championTeam: null });

  return NextResponse.json({
    championTeam: (existingPrediction as any)?.champion_team ?? null,
  });
}
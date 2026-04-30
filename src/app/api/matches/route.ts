import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";
export const dynamic = 'force-dynamic';
// Endpoint GET /api/matches
// Obtiene el listado de partidos guardados en Supabase (tabla matches)
export async function GET() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("matches")
    .select(
      "id, home_team, away_team, group_or_phase, kickoff_at, home_score, away_score, home_logo_url, away_logo_url"
    )
    .order("kickoff_at", { ascending: true });

  if (error) {
    // En caso de error devolvemos un 500 con el mensaje para depuración
    return NextResponse.json(
      { message: "Error al obtener partidos", error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data ?? []);
}


import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  apiFootballGet,
  ApiFootballFixture,
} from "@/lib/apiFootball";

// Endpoint GET /api/import-fixtures
// Importa partidos desde API-Football y los guarda en la tabla matches.
//
// Query params esperados:
// - league: ID de liga (ej. Liga MX: 262 en API-Football)
// - season: temporada (ej. 2026)
// - from / to: rango de fechas (YYYY-MM-DD), opcional
export async function GET(request: Request) {
  const url = new URL(request.url);
  const league = url.searchParams.get("league");
  const season = url.searchParams.get("season");
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;

  if (!league || !season) {
    return NextResponse.json(
      { message: "Faltan parámetros: league y season" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseClient();

  const data = await apiFootballGet<ApiFootballFixture>("/fixtures", {
    league,
    season,
    from,
    to,
  });

  const rows = (data.response ?? []).map((fx) => ({
    // Campos de tu tabla actual
    home_team: fx.teams.home.name,
    away_team: fx.teams.away.name,
    group_or_phase: `${fx.league.name} · ${fx.league.round}`,
    kickoff_at: fx.fixture.date,
    home_score: fx.goals.home,
    away_score: fx.goals.away,
    home_logo_url: fx.teams.home.logo ?? null,
    away_logo_url: fx.teams.away.logo ?? null,

    // Campos extra recomendados para automatización (debes agregarlos en Supabase)
    source: "api-football",
    external_id: String(fx.fixture.id),
    external_league: fx.league.id,
    external_season: fx.league.season,
  }));

  // Upsert para no duplicar fixtures importados
  const { error } = await supabase
    .from("matches")
    .upsert(rows, { onConflict: "source,external_id" });

  if (error) {
    return NextResponse.json(
      { message: "Error importando fixtures", error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    imported: rows.length,
  });
}


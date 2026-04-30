import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { apiFootballGet, ApiFootballFixture } from "@/lib/apiFootball";

function unauthorized() {
  return NextResponse.json({ message: "No autorizado" }, { status: 401 });
}

// Endpoint GET /api/import-worldcup
// Importa TODOS los fixtures del Mundial (API-Football league=1 season=2026).
//
// Seguridad:
// - Requiere header `x-sync-secret` o query `secret` que coincida con SYNC_SECRET en .env.local
export async function GET(request: Request) {
  const secret = process.env.SYNC_SECRET;
  if (!secret) {
    return NextResponse.json(
      { message: "Falta SYNC_SECRET en el servidor" },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const headerSecret = request.headers.get("x-sync-secret");

  if (querySecret !== secret && headerSecret !== secret) {
    return unauthorized();
  }

  const supabase = getSupabaseClient();

  const data = await apiFootballGet<ApiFootballFixture>("/fixtures", {
    league: 1,
    season: 2026,
  });

  const rows = (data.response ?? []).map((fx) => ({
    home_team: fx.teams.home.name,
    away_team: fx.teams.away.name,
    group_or_phase: `${fx.league.name} · ${fx.league.round}`,
    kickoff_at: fx.fixture.date,
    home_score: fx.goals.home,
    away_score: fx.goals.away,
    home_logo_url: fx.teams.home.logo ?? null,
    away_logo_url: fx.teams.away.logo ?? null,
    source: "api-football",
    external_id: String(fx.fixture.id),
    external_league: fx.league.id,
    external_season: fx.league.season,
  }));

  const { error } = await supabase
    .from("matches")
    .upsert(rows, { onConflict: "source,external_id" });

  if (error) {
    return NextResponse.json(
      { message: "Error importando Mundial", error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, imported: rows.length });
}


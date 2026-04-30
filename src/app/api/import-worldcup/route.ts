import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { apiFootballGet, ApiFootballFixture } from "@/lib/apiFootball";

function unauthorized() {
  return NextResponse.json({ message: "No autorizado" }, { status: 401 });
}

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
  
  // Detección automática de Vercel Cron Job
  const isVercelCron = request.headers.get("auth-action") === "cron-job";

  if (querySecret !== secret && headerSecret !== secret && !isVercelCron) {
    return unauthorized();
  }

  const supabase = getSupabaseClient();

  // Traemos los datos de la API
  const data = await apiFootballGet<ApiFootballFixture>("/fixtures", {
    league: 1,
    season: 2022,
  });

  if (!data.response || data.response.length === 0) {
    return NextResponse.json({ ok: true, imported: 0, message: "No se recibieron partidos de la API" });
  }

  const rows = data.response.map((fx) => {
    // LÓGICA DE GOLES: 
    // Si el partido no ha empezado (NS), los goles deben ser null o 0 para la quiniela.
    // Si ya terminó (FT) o está en juego, forzamos que el null sea 0 para evitar errores.
    const status = fx.fixture.status.short;
    const isStarted = !["NS", "TBD"].includes(status);

    return {
      home_team: fx.teams.home.name,
      away_team: fx.teams.away.name,
      group_or_phase: `${fx.league.name} · ${fx.league.round}`,
      kickoff_at: fx.fixture.date,
      // Si el partido empezó y la API manda null, ponemos 0. 
      // Si no ha empezado, mantenemos null para no confundir a la quiniela.
      home_score: isStarted ? (fx.goals.home ?? 0) : null,
      away_score: isStarted ? (fx.goals.away ?? 0) : null,
      home_logo_url: fx.teams.home.logo ?? null,
      away_logo_url: fx.teams.away.logo ?? null,
      source: "api-football",
      external_id: String(fx.fixture.id),
      external_league: fx.league.id,
      external_season: fx.league.season,
      // Guardamos el estado por si quieres usarlo luego (FT, NS, 1H, etc)
      status: status 
    };
  });

  const { error } = await supabase
    .from("matches")
    .upsert(rows, { 
      onConflict: "source,external_id",
      // Esto asegura que si el partido ya existe, se actualicen los goles y el estado
    });

  if (error) {
    return NextResponse.json(
      { message: "Error importando Mundial", error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ 
    ok: true, 
    imported: rows.length,
    timestamp: new Date().toISOString() 
  });
}
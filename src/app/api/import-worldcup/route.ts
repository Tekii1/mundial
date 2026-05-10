import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { apiFootballGet, ApiFootballFixture } from "@/lib/apiFootball";

// Evitamos el cache para tener datos en tiempo real
export const revalidate = 0;

function unauthorized() {
  return NextResponse.json({ message: "No autorizado" }, { status: 401 });
}

export async function GET(request: Request) {
  // 1. Validación de Seguridad
  const secret = process.env.SYNC_SECRET;
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const headerSecret = request.headers.get("x-sync-secret");
  const isVercelCron = request.headers.get("auth-action") === "cron-job";

  if (querySecret !== secret && headerSecret !== secret && !isVercelCron) {
    return unauthorized();
  }

  const supabase = getSupabaseClient();
  const LEAGUE_ID = 1; // FIFA World Cup
  const SEASON = 2026;

  try {
    // 2. Intento A: Búsqueda estándar por Liga y Temporada
    let apiResponse = await apiFootballGet<ApiFootballFixture>("/fixtures", {
      league: LEAGUE_ID,
      season: SEASON,
    });

    // 3. Intento B: Si el A falla, buscamos los próximos 99 partidos de la liga
    // Este método (next) suele saltarse errores de indexación de temporada en torneos FIFA
    if (!apiResponse.response || apiResponse.response.length === 0) {
      console.log("Temporada no encontrada, intentando con parámetro 'next'...");
      apiResponse = await apiFootballGet<ApiFootballFixture>("/fixtures", {
        league: LEAGUE_ID,
        next: 99,
      });
    }

    if (!apiResponse.response || apiResponse.response.length === 0) {
      return NextResponse.json({
        ok: true,
        imported: 0,
        message: `La API de Football aún no devuelve partidos para la liga ${LEAGUE_ID}.`,
      });
    }

    // 4. Mapeo de datos según la estructura de la documentación V3
    const rows = apiResponse.response.map((fx) => {
      const status = fx.fixture.status.short;
      
      // Lista de estados donde el partido ya tiene goles (Live o Finalizado)
      const activeStatuses = ["1H", "2H", "ET", "P", "LIVE", "FT", "PEN", "AET"];
      const isStarted = activeStatuses.includes(status);

      return {
        external_id: String(fx.fixture.id),
        home_team: fx.teams.home.name,
        away_team: fx.teams.away.name,
        home_logo_url: fx.teams.home.logo ?? null,
        away_logo_url: fx.teams.away.logo ?? null,
        group_or_phase: `${fx.league.round}`, 
        kickoff_at: fx.fixture.date,
        // Solo guardamos goles si el partido realmente empezó
        home_score: isStarted ? (fx.goals.home ?? 0) : null,
        away_score: isStarted ? (fx.goals.away ?? 0) : null,
        status: status,
        source: "api-football",
        external_league: fx.league.id,
        external_season: fx.league.season,
      };
    });

    // 5. Upsert masivo en Supabase
    const { error: upsertError } = await supabase
      .from("matches")
      .upsert(rows, { 
        onConflict: "source,external_id" 
      });

    if (upsertError) {
      throw new Error(`Error en Supabase: ${upsertError.message}`);
    }

    return NextResponse.json({
      ok: true,
      imported: rows.length,
      message: "Sincronización completada exitosamente",
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error("Error crítico en import-worldcup:", err);
    return NextResponse.json(
      {
        message: "Error interno en el servidor",
        error: err instanceof Error ? err.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
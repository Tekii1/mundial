import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  apiFootballGet,
  ApiFootballFixture,
  isFinishedStatus,
} from "@/lib/apiFootball";

function unauthorized() {
  return NextResponse.json({ message: "No autorizado" }, { status: 401 });
}

// Endpoint POST/GET /api/sync-results
// Actualiza resultados en matches consultando API-Football para fixtures ya importados.
//
// Seguridad:
// - Requiere header `x-sync-secret` o query `secret` que coincida con SYNC_SECRET en .env.local
export async function GET(request: Request) {
  return sync(request);
}

export async function POST(request: Request) {
  return sync(request);
}

async function sync(request: Request) {
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

  // Buscamos fixtures importados (con external_id) que ya deberían tener resultado
  const { data: matches, error } = await supabase
    .from("matches")
    .select("id, external_id, source")
    .eq("source", "api-football")
    .not("external_id", "is", null);

  if (error) {
    return NextResponse.json(
      { message: "Error leyendo matches", error: error.message },
      { status: 500 }
    );
  }

  const ids = (matches ?? [])
    .map((m) => String((m as any).external_id))
    .filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, message: "Nada que sincronizar" });
  }

  // API-Football permite consultar múltiples ids separados por coma con `ids`
  const fx = await apiFootballGet<ApiFootballFixture>("/fixtures", {
    ids: ids.join(","),
  });

  const updates = (fx.response ?? [])
    .filter((f) => isFinishedStatus(f.fixture.status.short))
    .filter((f) => f.goals.home !== null && f.goals.away !== null)
    .map((f) => ({
      source: "api-football",
      external_id: String(f.fixture.id),
      home_score: f.goals.home,
      away_score: f.goals.away,
      home_logo_url: f.teams.home.logo ?? null,
      away_logo_url: f.teams.away.logo ?? null,
    }));

  if (updates.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const { error: upsertError } = await supabase
    .from("matches")
    .upsert(updates, { onConflict: "source,external_id" });

  if (upsertError) {
    return NextResponse.json(
      { message: "Error actualizando resultados", error: upsertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, updated: updates.length });
}


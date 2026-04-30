import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";

// Definimos la interfaz para evitar el error de "never"
interface UserRow {
  id: string;
  name?: string;
}

// Endpoint GET /api/champion
// Devuelve el candidato a campeón del usuario autenticado (si ya existe).
export async function GET(request: Request) {
  const supabase = getSupabaseClient();

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7)
    : null;

  if (!token) {
    return NextResponse.json({ championTeam: null }, { status: 200 });
  }

  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData.user) {
    return NextResponse.json({ championTeam: null }, { status: 200 });
  }

  const authUserId = authData.user.id;

  // Aplicamos el tipo UserRow a la respuesta de la consulta
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle() as { data: UserRow | null };

  // Ahora TypeScript sabe que user puede tener un .id
  if (!user?.id) {
    return NextResponse.json({ championTeam: null }, { status: 200 });
  }

  const { data: existingChampion } = await supabase
    .from("tournament_predictions")
    .select("champion_team")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    championTeam: existingChampion?.champion_team ?? null,
  });
}

// Endpoint POST /api/champion
// Guarda una única vez el candidato a campeón del Mundial para el usuario autenticado.
export async function POST(request: Request) {
  const supabase = getSupabaseClient();

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7)
    : null;

  if (!token) {
    return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(
    token
  );
  if (authError || !authData.user) {
    return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  }

  const authUserId = authData.user.id;

  const body = (await request.json()) as { championTeam?: string; userName?: string };
  const championTeam = body.championTeam?.trim();
  const userName = body.userName?.trim();

  if (!championTeam || !userName) {
    return NextResponse.json(
      { message: "Faltan datos (championTeam o userName)" },
      { status: 400 }
    );
  }

  // 1) Buscar/crear user en public.users ligado a auth_user_id
  const { data: existingUser, error: userSelectError } = await supabase
    .from("users")
    .select("id, name")
    .eq("auth_user_id", authUserId)
    .maybeSingle() as { data: UserRow | null, error: any };

  if (userSelectError && userSelectError.code !== "PGRST116") {
    return NextResponse.json(
      { message: "Error buscando usuario", error: userSelectError.message },
      { status: 500 }
    );
  }

  let userId = existingUser?.id;

  if (!userId) {
    const { data: newUser, error: insertUserError } = await supabase
      .from("users")
      .insert({ name: userName, auth_user_id: authUserId })
      .select("id")
      .single() as { data: UserRow | null, error: any };

    if (insertUserError || !newUser) {
      return NextResponse.json(
        { message: "Error creando usuario", error: insertUserError?.message },
        { status: 500 }
      );
    }

    userId = newUser.id;
  } else if (existingUser?.name !== userName) {
    await supabase.from("users").update({ name: userName }).eq("id", userId);
  }

  // 2) Ver si ya existe predicción de campeón (solo una vez)
  const { data: existingChampion, error: championSelectError } = await supabase
    .from("tournament_predictions")
    .select("id, champion_team")
    .eq("user_id", userId)
    .maybeSingle();

  if (championSelectError && championSelectError.code !== "PGRST116") {
    return NextResponse.json(
      {
        message: "Error consultando candidato a campeón",
        error: championSelectError.message,
      },
      { status: 500 }
    );
  }

  if (existingChampion?.id) {
    // No permitimos cambiarlo (regla de "solo una vez")
    return NextResponse.json(
      {
        ok: true,
        locked: true,
        championTeam: existingChampion.champion_team,
      },
      { status: 200 }
    );
  }

  const { error: insertChampionError } = await supabase
    .from("tournament_predictions")
    .insert({
      user_id: userId,
      champion_team: championTeam,
    });

  if (insertChampionError) {
    return NextResponse.json(
      { message: "Error guardando candidato", error: insertChampionError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, locked: true, championTeam });
}
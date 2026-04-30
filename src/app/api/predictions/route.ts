import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";

// Tipo de predicción que esperamos recibir desde el frontend
type IncomingPrediction = {
  matchId: string;
  home: number;
  away: number;
};

// Endpoint POST /api/predictions
// Guarda (o actualiza) las predicciones del usuario autenticado para varios partidos
export async function POST(request: Request) {
  const supabase = getSupabaseClient();

  const body = (await request.json()) as {
    userName?: string;
    predictions?: IncomingPrediction[];
  };

  // Identidad del usuario: debe venir autenticado (Bearer token)
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7)
    : null;

  if (!token) {
    return NextResponse.json(
      { message: "No autenticado" },
      { status: 401 }
    );
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(
    token
  );
  if (authError || !authData.user) {
    return NextResponse.json(
      { message: "No autenticado" },
      { status: 401 }
    );
  }

  const authUserId = authData.user.id;

  // Nombre visible (alias) que mostraremos en ranking
  const userName = body.userName?.trim();
  const incoming = body.predictions ?? [];

  if (!userName || incoming.length === 0) {
    return NextResponse.json(
      { message: "Faltan nombre de usuario o predicciones" },
      { status: 400 }
    );
  }

  // 1) Buscar si ya existe un usuario ligado a este auth_user_id
  const { data: existingUser, error: userSelectError } = await supabase
    .from("users")
    .select("id, name")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (userSelectError && userSelectError.code !== "PGRST116") {
    return NextResponse.json(
      { message: "Error buscando usuario", error: userSelectError.message },
      { status: 500 }
    );
  }

  let userId = existingUser?.id as string | undefined;

  // 2) Si no existe, lo creamos con auth_user_id
  if (!userId) {
    const { data: newUser, error: insertUserError } = await supabase
      .from("users")
      .insert({ name: userName, auth_user_id: authUserId })
      .select("id, name")
      .single();

    if (insertUserError || !newUser) {
      return NextResponse.json(
        {
          message: "Error creando usuario",
          error: insertUserError?.message,
        },
        { status: 500 }
      );
    }

    userId = newUser.id as string;
  } else if (existingUser?.name !== userName) {
    // Si el usuario existe pero cambió el alias local, actualizamos el nombre visible
    await supabase
      .from("users")
      .update({ name: userName })
      .eq("id", userId);
  }

  // 3) Preparar filas para upsert en la tabla predictions
  const rows = incoming.map((p) => ({
    user_id: userId,
    match_id: p.matchId,
    predicted_home_score: p.home,
    predicted_away_score: p.away,
  }));

  const { error: upsertError } = await supabase
    .from("predictions")
    .upsert(rows, { onConflict: "user_id,match_id" });

  if (upsertError) {
    return NextResponse.json(
      {
        message: "Error guardando predicciones",
        error: upsertError.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}


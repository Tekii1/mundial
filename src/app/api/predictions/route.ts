import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";

// --- MÉTODO POST (Guardar con Seguridad) ---
export async function POST(request: Request) {
  const supabase = getSupabaseClient();
  const body = await request.json();
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;

  if (!token) return NextResponse.json({ message: "No autenticado" }, { status: 401 });

  // 1. Verificar identidad del usuario
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ message: "No autenticado" }, { status: 401 });

  const authUserId = authData.user.id;
  const userName = body.userName?.trim();
  const incomingPredictions = body.predictions ?? [];

  if (incomingPredictions.length === 0) {
    return NextResponse.json({ message: "No hay predicciones para guardar" });
  }

  // 2. Buscar o crear el ID interno del usuario en la tabla 'users'
  const { data: userRecord } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  let userId = userRecord?.id;
  if (!userId) {
    const { data: newUser } = await supabase
      .from("users")
      .insert({ name: userName, auth_user_id: authUserId })
      .select("id")
      .single();
    userId = newUser?.id;
  }

  // 3. LOGICA DE SEGURIDAD: Obtener kickoff_at de los partidos que intenta guardar
  const matchIds = incomingPredictions.map((p: any) => p.matchId);
  const { data: matchesFromDb, error: matchesError } = await supabase
    .from("matches")
    .select("id, kickoff_at")
    .in("id", matchIds);

  if (matchesError || !matchesFromDb) {
    return NextResponse.json({ error: "No se pudo verificar el horario de los partidos" }, { status: 500 });
  }

  // 4. Filtrar solo las predicciones que aún son válidas (antes del inicio)
  const now = new Date();
  const validRows = [];
  const blockedMatches = [];

  for (const pred of incomingPredictions) {
    const matchInfo = matchesFromDb.find(m => m.id === pred.matchId);
    
    if (matchInfo) {
      const kickoffTime = new Date(matchInfo.kickoff_at);
      
      // Solo permitimos si el partido NO ha empezado
      if (now < kickoffTime) {
        validRows.push({
          user_id: userId,
          match_id: pred.matchId,
          predicted_home_score: pred.home,
          predicted_away_score: pred.away,
        });
      } else {
        blockedMatches.push(pred.matchId);
      }
    }
  }

  // 5. Si no hay nada válido para guardar, avisamos al usuario
  if (validRows.length === 0) {
    return NextResponse.json({ 
      message: "Error: Los partidos ya han comenzado y no se pueden editar.",
      blockedCount: blockedMatches.length 
    }, { status: 403 });
  }

  // 6. Hacer el UPSERT solo con las filas permitidas
  const { error: upsertError } = await supabase
    .from("predictions")
    .upsert(validRows, { onConflict: "user_id,match_id" });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ 
    ok: true, 
    savedCount: validRows.length,
    blockedCount: blockedMatches.length 
  });
}

// --- MÉTODO GET (Recuperar) ---
export async function GET(request: Request) {
  const supabase = getSupabaseClient();
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;

  if (!token) return NextResponse.json({ message: "No token" }, { status: 401 });

  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData.user) return NextResponse.json({ message: "No user" }, { status: 401 });

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", authData.user.id)
    .single();

  if (!user) return NextResponse.json([]);

  const { data: predictions, error } = await supabase
    .from("predictions")
    .select("match_id, predicted_home_score, predicted_away_score")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(predictions);
}
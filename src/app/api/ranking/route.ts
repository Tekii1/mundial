import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";

type User = { id: string; name: string };
type Match = { id: string; home_score: number | null; away_score: number | null; home_team: string; away_team: string; status: string; group_or_phase: string };
type Prediction = { user_id: string; match_id: string; predicted_home_score: number; predicted_away_score: number };

function calculatePoints(
  predictedHome: number,
  predictedAway: number,
  realHome: number | null,
  realAway: number | null
): { points: number; exact: boolean; correct: boolean } {
  if (realHome === null || realAway === null) return { points: 0, exact: false, correct: false };

  const exact = predictedHome === realHome && predictedAway === realAway;
  const predictedSign = Math.sign(predictedHome - predictedAway);
  const realSign = Math.sign(realHome - realAway);

  if (exact) return { points: 3, exact: true, correct: true };
  if (predictedSign === realSign) return { points: 1, exact: false, correct: true };
  return { points: 0, exact: false, correct: false };
}

export async function GET() {
  const supabase = getSupabaseClient();

  const [
    { data: users, error: usersError },
    { data: matches, error: matchesError },
    { data: predictions, error: predictionsError },
    { data: championPreds, error: championPredsError },
  ] = await Promise.all([
    supabase.from("users").select("id, name"),
    supabase.from("matches").select("id, home_score, away_score, home_team, away_team, status, group_or_phase"),
    supabase.from("predictions").select("user_id, match_id, predicted_home_score, predicted_away_score"),
    supabase.from("tournament_predictions").select("user_id, champion_team"),
  ]);

  if (usersError || matchesError || predictionsError || championPredsError) {
    return NextResponse.json({ message: "Error al obtener datos" }, { status: 500 });
  }

  // --- DETECCIÓN AUTOMÁTICA DEL CAMPEÓN REAL ---
  // Buscamos el partido que contenga "Final" en su fase y que haya terminado (FT)
  const finalMatch = (matches as Match[] || []).find(m => 
    m.group_or_phase.toLowerCase().includes("final") && 
    !m.group_or_phase.toLowerCase().includes("semi") &&
    !m.group_or_phase.toLowerCase().includes("quarter") &&
    m.status === "FT"
  );

  let realChampion: string | null = null;
  if (finalMatch && finalMatch.home_score !== null && finalMatch.away_score !== null) {
    if (finalMatch.home_score > finalMatch.away_score) realChampion = finalMatch.home_team;
    else if (finalMatch.away_score > finalMatch.home_score) realChampion = finalMatch.away_team;
    // Nota: Si empatan, la API-Football actualiza los goles tras penales o puedes manualizar este dato.
  }

  const results = new Map<string, any>();

  // Mapa de lo que cada usuario eligió como campeón
  const pickedByUser = new Map<string, string>();
  (championPreds ?? []).forEach((r) => pickedByUser.set(r.user_id, r.champion_team));

  // Inicializar ranking
  (users ?? []).forEach((u) => {
    results.set(u.id, {
      userId: u.id,
      name: u.name,
      totalPoints: 0,
      exactCount: 0,
      correctCount: 0,
      championTeam: pickedByUser.get(u.id) || null,
      guessedChampion: false
    });
  });

  const matchesById = new Map<string, Match>();
  (matches ?? []).forEach((m) => matchesById.set(m.id, m as Match));

  // Calcular puntos por partidos
  (predictions ?? []).forEach((p) => {
    const pred = p as Prediction;
    const match = matchesById.get(pred.match_id);
    if (!match) return;

    const { points, exact, correct } = calculatePoints(
      pred.predicted_home_score,
      pred.predicted_away_score,
      match.home_score,
      match.away_score
    );

    const acc = results.get(pred.user_id);
    if (acc) {
      acc.totalPoints += points;
      if (exact) acc.exactCount += 1;
      if (correct) acc.correctCount += 1;
    }
  });

  // --- APLICAR BONUS DE CAMPEÓN ---
  if (realChampion) {
    results.forEach((user) => {
      if (user.championTeam && user.championTeam.toLowerCase().trim() === realChampion?.toLowerCase().trim()) {
        user.totalPoints += 20; // Bonus de 20 puntos
        user.guessedChampion = true;
      }
    });
  }

  const ranking = Array.from(results.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
    return b.correctCount - a.correctCount;
  });

  return NextResponse.json(ranking);
}
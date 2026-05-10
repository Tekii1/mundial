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

  // Forzamos casting 'as any' en las consultas para evitar que TS bloquee el acceso a propiedades
  const [
    { data: users, error: usersError },
    { data: matches, error: matchesError },
    { data: predictions, error: predictionsError },
    { data: championPreds, error: championPredsError },
  ] = await Promise.all([
    supabase.from("users").select("id, name") as any,
    supabase.from("matches").select("id, home_score, away_score, home_team, away_team, status, group_or_phase") as any,
    supabase.from("predictions").select("user_id, match_id, predicted_home_score, predicted_away_score") as any,
    supabase.from("tournament_predictions").select("user_id, champion_team") as any,
  ]);

  if (usersError || matchesError || predictionsError || championPredsError) {
    return NextResponse.json({ message: "Error al obtener datos" }, { status: 500 });
  }

  // --- DETECCIÓN AUTOMÁTICA DEL CAMPEÓN REAL ---
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
  }

  const results = new Map<string, any>();

  // Mapa de lo que cada usuario eligió como campeón
  const pickedByUser = new Map<string, string>();
  // Usamos casting a any[] para que r.user_id no de error
  (championPreds as any[] || []).forEach((r) => {
    pickedByUser.set(r.user_id, r.champion_team);
  });

  // Inicializar ranking
  (users as User[] || []).forEach((u) => {
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
  (matches as Match[] || []).forEach((m) => matchesById.set(m.id, m));

  // Calcular puntos por partidos
  (predictions as Prediction[] || []).forEach((p) => {
    const match = matchesById.get(p.match_id);
    if (!match) return;

    const { points, exact, correct } = calculatePoints(
      p.predicted_home_score,
      p.predicted_away_score,
      match.home_score,
      match.away_score
    );

    const acc = results.get(p.user_id);
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
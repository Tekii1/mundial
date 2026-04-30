import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";

type User = {
  id: string;
  name: string;
};

type Match = {
  id: string;
  home_score: number | null;
  away_score: number | null;
};

type Prediction = {
  user_id: string;
  match_id: string;
  predicted_home_score: number;
  predicted_away_score: number;
};

// Calcula los puntos de una predicción contra el resultado real
function calculatePoints(
  predictedHome: number,
  predictedAway: number,
  realHome: number | null,
  realAway: number | null
): { points: number; exact: boolean; correct: boolean } {
  if (realHome === null || realAway === null) {
    return { points: 0, exact: false, correct: false };
  }

  const exact =
    predictedHome === realHome && predictedAway === realAway;

  const predictedDiff = predictedHome - predictedAway;
  const realDiff = realHome - realAway;

  const predictedSign = Math.sign(predictedDiff);
  const realSign = Math.sign(realDiff);

  if (exact) {
    return { points: 3, exact: true, correct: true };
  }

  if (predictedSign === realSign) {
    return { points: 1, exact: false, correct: true };
  }

  return { points: 0, exact: false, correct: false };
}

// Endpoint GET /api/ranking
// Devuelve la tabla de posiciones calculada a partir de users, matches y predictions
export async function GET() {
  const supabase = getSupabaseClient();

  const [
    { data: users, error: usersError },
    { data: matches, error: matchesError },
    { data: predictions, error: predictionsError },
    { data: championInfo, error: championInfoError },
    { data: championPreds, error: championPredsError },
  ] =
    await Promise.all([
      supabase.from("users").select("id, name"),
      supabase
        .from("matches")
        .select("id, home_score, away_score"),
      supabase
        .from("predictions")
        .select(
          "user_id, match_id, predicted_home_score, predicted_away_score"
        ),
      // Campeón real (cuando exista)
      supabase.from("tournament_info").select("champion_team").eq("id", 1).maybeSingle(),
      // Candidatos de campeón por usuario
      supabase.from("tournament_predictions").select("user_id, champion_team"),
    ]);

  if (
    usersError ||
    matchesError ||
    predictionsError ||
    championInfoError ||
    championPredsError
  ) {
    return NextResponse.json(
      {
        message: "Error al obtener datos para el ranking",
        usersError: usersError?.message,
        matchesError: matchesError?.message,
        predictionsError: predictionsError?.message,
        championInfoError: championInfoError?.message,
        championPredsError: championPredsError?.message,
      },
      { status: 500 }
    );
  }

  const usersById = new Map<string, User>();
  (users ?? []).forEach((u) => {
    usersById.set(u.id, u as User);
  });

  const matchesById = new Map<string, Match>();
  (matches ?? []).forEach((m) => {
    matchesById.set(m.id, m as Match);
  });

  type Acc = {
    userId: string;
    name: string;
    totalPoints: number;
    exactCount: number;
    correctCount: number;
  };

  const results = new Map<string, Acc>();

  // Inicializamos el ranking con todos los usuarios (aunque tengan 0 puntos)
  (users ?? []).forEach((u) => {
    const user = u as User;
    results.set(user.id, {
      userId: user.id,
      name: user.name,
      totalPoints: 0,
      exactCount: 0,
      correctCount: 0,
    });
  });

  (predictions ?? []).forEach((p) => {
    const pred = p as Prediction;
    const user = usersById.get(pred.user_id);
    const match = matchesById.get(pred.match_id);

    if (!user || !match) return;

    const { points, exact, correct } = calculatePoints(
      pred.predicted_home_score,
      pred.predicted_away_score,
      match.home_score,
      match.away_score
    );

    const acc = results.get(user.id)!;
    acc.totalPoints += points;
    if (exact) acc.exactCount += 1;
    if (correct) acc.correctCount += 1;
  });

  const ranking = Array.from(results.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    // Desempate por más marcadores exactos
    if (b.exactCount !== a.exactCount) {
      return b.exactCount - a.exactCount;
    }
    // Segundo desempate por más partidos acertados
    return b.correctCount - a.correctCount;
  });

  // Bonus de campeón (+20) si ya se definió el campeón real del torneo
  const realChampion = (championInfo as any)?.champion_team as string | null | undefined;
  if (realChampion) {
    const pickedByUser = new Map<string, string>();
    (championPreds ?? []).forEach((r) => {
      pickedByUser.set((r as any).user_id, (r as any).champion_team);
    });

    ranking.forEach((row) => {
      const picked = pickedByUser.get(row.userId);
      if (picked && picked === realChampion) {
        row.totalPoints += 20;
      }
    });

    // Re-ordenamos porque el bonus puede cambiar posiciones
    ranking.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
      return b.correctCount - a.correctCount;
    });
  }

  return NextResponse.json(ranking);
}


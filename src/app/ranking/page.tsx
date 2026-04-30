"use client";

import { useEffect, useState } from "react";

type RankingRow = {
  userId: string;
  name: string;
  totalPoints: number;
  correctCount: number;
  exactCount: number;
  championTeam?: string; // El equipo que eligió el usuario
  guessedChampion?: boolean; // Si acertó o no (lo enviará la API)
};

export default function RankingPage() {
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        setIsLoading(true);
        // Añadimos un timestamp para evitar cache y ver los puntos al instante
        const res = await fetch(`/api/ranking?t=${Date.now()}`);
        if (!res.ok) {
          throw new Error("No se pudo cargar el ranking");
        }
        const data: RankingRow[] = await res.json();
        setRows(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRanking();
  }, []);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Ranking</h1>
        <div className="text-sm text-neutral-300 space-y-1">
          <p>• Partido Acertado = 1 punto.</p>
          <p>• Marcador Exacto = 3 puntos.</p>
          <p className="text-emerald-400 font-medium">• Acertar Campeón = 5 puntos extra.</p>
        </div>
      </header>

      {isLoading && <p className="text-sm text-neutral-400">Cargando ranking...</p>}

      {error && (
        <p className="text-sm text-red-400">
          Hubo un problema al cargar el ranking: {error}
        </p>
      )}

      {!isLoading && !error && rows.length === 0 && (
        <p className="text-sm text-neutral-300">Aún no hay puntos asignados.</p>
      )}

      {!isLoading && !error && rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-neutral-300">
              <tr>
                <th className="px-4 py-3 text-left">Pos</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Campeón elegido</th>
                <th className="px-4 py-3 text-right">Pts Totales</th>
                <th className="px-4 py-3 text-right">Acertados</th>
                <th className="px-4 py-3 text-right">Exactos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-transparent">
              {rows.map((row, index) => (
                <tr key={row.userId} className={row.guessedChampion ? "bg-emerald-500/5" : ""}>
                  <td className="px-4 py-3 text-left text-neutral-400">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 text-left font-medium text-neutral-50">
                    {row.name}
                  </td>
                  <td className="px-4 py-3 text-left">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      row.guessedChampion 
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                        : "bg-white/5 text-neutral-400"
                    }`}>
                      {row.championTeam || "No elegido"} {row.guessedChampion && "🏆"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-400">
                    {row.totalPoints}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-300">
                    {row.correctCount}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-300">
                    {row.exactCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
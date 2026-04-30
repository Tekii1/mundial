"use client";

import { useEffect, useState } from "react";

type RankingRow = {
  userId: string;
  name: string;
  totalPoints: number;
  correctCount: number;
  exactCount: number;
};

// Página de ranking: muestra la tabla de posiciones calculada
export default function RankingPage() {
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/ranking");
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
      {/* Encabezado explicando qué representa este ranking */}
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Ranking</h1>
        <p className="text-sm text-neutral-300">
          Tabla de posiciones calculada a partir de las predicciones y los
          resultados reales de los partidos.
        </p>
      </header>

      {isLoading && (
        <p className="text-sm text-neutral-400">Cargando ranking...</p>
      )}

      {error && (
        <p className="text-sm text-red-400">
          Hubo un problema al cargar el ranking: {error}
        </p>
      )}

      {!isLoading && !error && rows.length === 0 && (
        <p className="text-sm text-neutral-300">
          Aún no hay puntos asignados. Cuando se carguen resultados reales en
          los partidos y haya predicciones registradas, el ranking aparecerá
          aquí.
        </p>
      )}

      {/* Tabla que lista a los participantes ordenados por puntos */}
      {!isLoading && !error && rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-neutral-300">
              <tr>
                <th className="px-4 py-3 text-left">Posición</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-right">Puntos totales</th>
                <th className="px-4 py-3 text-right">Partidos acertados</th>
                <th className="px-4 py-3 text-right">Marcadores exactos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-transparent">
              {rows.map((row, index) => (
                <tr key={row.userId}>
                  <td className="px-4 py-3 text-left text-neutral-200">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 text-left font-medium text-neutral-50">
                    {row.name}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-100">
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


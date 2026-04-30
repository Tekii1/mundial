 "use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

// Tipo básico de partido, alineado con la tabla matches de Supabase
type Match = {
  id: string;
  home_team: string;
  away_team: string;
  group_or_phase: string;
  kickoff_at: string;
  home_logo_url?: string | null;
  away_logo_url?: string | null;
};

// Estado de predicciones por partido: { [matchId]: { home: string, away: string } }
type PredictionsState = Record<
  string,
  {
    home: string;
    away: string;
  }
>;

// Página donde construiremos el formulario de creación de quinielas
export default function QuinielaPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<PredictionsState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [championTeam, setChampionTeam] = useState<string>("");
  const [championLocked, setChampionLocked] = useState<boolean>(false);
  const [isSavingChampion, setIsSavingChampion] = useState(false);

  // Al montar el componente, obtenemos la lista de partidos desde /api/matches
  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/matches");
        if (!res.ok) {
          throw new Error("No se pudieron cargar los partidos");
        }
        const data: Match[] = await res.json();
        setMatches(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMatches();
  }, []);

  // Al cargar la página: forzamos login y obtenemos accessToken para llamar APIs protegidas
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedName = window.localStorage.getItem("quinielaUserName") ?? "";
    if (storedName.trim()) setUserName(storedName.trim());

    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (!session?.access_token) {
        router.push("/auth");
        return;
      }
      setAccessToken(session.access_token);
    });
  }, []);

  // Si ya existe un candidato a campeón guardado, lo cargamos y bloqueamos el selector
  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/champion", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.championTeam) {
          setChampionTeam(data.championTeam);
          setChampionLocked(true);
        }
      })
      .catch(() => null);
  }, [accessToken]);

  // Maneja el cambio de marcador predicho para un partido concreto
  const handlePredictionChange = (
    matchId: string,
    field: "home" | "away",
    value: string
  ) => {
    setPredictions((prev) => ({
      ...prev,
      [matchId]: {
        home: field === "home" ? value : prev[matchId]?.home ?? "",
        away: field === "away" ? value : prev[matchId]?.away ?? "",
      },
    }));
  };

  // Envía las predicciones actuales al backend para guardarlas en Supabase
  const handleSavePredictions = async () => {
    setSaveMessage(null);

    const trimmedName = userName.trim();
    if (!trimmedName) return;
    if (!accessToken) {
      setSaveMessage("Necesitas iniciar sesión para guardar tu quiniela.");
      return;
    }

    // Convertimos el estado de predicciones en un arreglo filtrando
    // aquellas donde falte algún marcador.
    const payload = Object.entries(predictions)
      .map(([matchId, scores]) => {
        const home = parseInt(scores.home, 10);
        const away = parseInt(scores.away, 10);

        if (Number.isNaN(home) || Number.isNaN(away)) {
          return null;
        }

        return { matchId, home, away };
      })
      .filter((p): p is { matchId: string; home: number; away: number } => p !== null);

    if (payload.length === 0) {
      setSaveMessage("No hay predicciones completas para guardar.");
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userName: trimmedName,
          predictions: payload,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "No se pudieron guardar las predicciones");
      }

      // Guardamos el nombre en localStorage para no tener que escribirlo cada vez
      if (typeof window !== "undefined") {
        window.localStorage.setItem("quinielaUserName", trimmedName);
      }

      setSaveMessage("¡Quiniela guardada correctamente!");
    } catch (err) {
      setSaveMessage(
        err instanceof Error
          ? `Error al guardar la quiniela: ${err.message}`
          : "Error desconocido al guardar la quiniela."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Equipos únicos para selector de campeón (derivados de los partidos)
  const teams = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => {
      set.add(m.home_team);
      set.add(m.away_team);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [matches]);

  const groupedMatches = useMemo(() => {
    const map = new Map<string, Match[]>();
    matches.forEach((m) => {
      const key = m.group_or_phase || "Otros";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });
    for (const list of map.values()) {
      list.sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [matches]);

  // Navegación por "pasos" (grupos/fases). Primera pantalla: campeón.
  const [stepIndex, setStepIndex] = useState(0);

  // Determina si un match tiene predicción completa (ambos marcadores)
  const isMatchFilled = (matchId: string) => {
    const p = predictions[matchId];
    if (!p) return false;
    return p.home.trim() !== "" && p.away.trim() !== "";
  };

  const steps = useMemo(() => {
    // Paso 0: campeón, luego cada group_or_phase
    return ["__champion__", ...groupedMatches.map(([g]) => g)];
  }, [groupedMatches]);

  const currentGroup =
    stepIndex <= 0 ? null : steps[stepIndex] === "__champion__" ? null : steps[stepIndex];

  const currentMatches =
    currentGroup === null
      ? []
      : groupedMatches.find(([g]) => g === currentGroup)?.[1] ?? [];

  const currentCompleteCount = currentMatches.filter((m) => isMatchFilled(m.id))
    .length;

  const canGoNext =
    stepIndex === 0
      ? championLocked
      : currentMatches.length > 0 && currentCompleteCount === currentMatches.length;

  const handleSaveChampion = async () => {
    setSaveMessage(null);
    const trimmedName = userName.trim();
    if (!accessToken) {
      setSaveMessage("Necesitas iniciar sesión para seleccionar tu campeón.");
      return;
    }
    if (!championTeam) {
      setSaveMessage("Selecciona un candidato a campeón.");
      return;
    }
    try {
      setIsSavingChampion(true);
      const res = await fetch("/api/champion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userName: trimmedName,
          championTeam,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || "No se pudo guardar el candidato");
      }
      setChampionLocked(true);
      setChampionTeam(data?.championTeam || championTeam);
      setSaveMessage("Candidato a campeón guardado.");
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : "Error guardando candidato."
      );
    } finally {
      setIsSavingChampion(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Encabezado descriptivo de la funcionalidad */}
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Crear quiniela
        </h1>
        <p className="text-sm text-neutral-300">
          Selecciona tus marcadores para cada partido del Mundial. Más adelante
          guardaremos estas predicciones en Supabase y calcularemos los puntos
          automáticamente.
        </p>
      </header>

      {/* Barra de progreso / navegación por pasos */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-300">
            Progreso
          </p>
          <p className="text-sm text-neutral-200">
            Paso {Math.min(stepIndex + 1, steps.length)} de {steps.length}
            {stepIndex === 0 ? (
              <span className="text-neutral-400"> · Candidato a campeón</span>
            ) : (
              <span className="text-neutral-400">
                {" "}
                · {currentGroup} ({currentCompleteCount}/{currentMatches.length})
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-medium text-neutral-100 hover:border-white/35 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
            disabled={!canGoNext || stepIndex >= steps.length - 1}
            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-neutral-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Paso 1: Selección única de campeón */}
      {stepIndex === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-300">
            Paso 1 · Candidato a campeón
          </p>
          <p className="mt-1 text-sm text-neutral-300">
            Elige una sola vez tu candidato a ganar el Mundial. Esta selección
            se usa para la bonificación de +20 puntos al final.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-neutral-300">
                Candidato a campeón
              </label>
              <select
                disabled={championLocked}
                className="mt-1 w-full rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 outline-none focus:border-emerald-400 disabled:opacity-70"
                value={championTeam}
                onChange={(e) => setChampionTeam(e.target.value)}
              >
                <option value="">Selecciona un equipo</option>
                {teams.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleSaveChampion}
              disabled={championLocked || isSavingChampion}
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-neutral-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {championLocked
                ? "Candidato guardado"
                : isSavingChampion
                ? "Guardando..."
                : "Guardar candidato"}
            </button>
          </div>
        </div>
      )}

      {/* Botón global para guardar quiniela (solo cuando ya elegiste campeón) */}
      {stepIndex > 0 && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-300">
              Predicciones
            </p>
            <p className="mt-1 text-sm text-neutral-300">
              Completa los marcadores del paso actual y avanza. Puedes guardar
              cuando quieras.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSavePredictions}
            disabled={isSaving || !championLocked}
            className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-neutral-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Guardando..." : "Guardar quiniela"}
          </button>
        </div>
      )}

      {saveMessage && (
        <p className="text-xs text-neutral-300">{saveMessage}</p>
      )}

      {/* Estados de carga o error al traer los partidos */}
      {isLoading && (
        <p className="text-sm text-neutral-400">Cargando partidos...</p>
      )}
      {error && (
        <p className="text-sm text-red-400">
          Hubo un problema al cargar los partidos: {error}
        </p>
      )}

      {/* Mensaje cuando aún no hay partidos en la base de datos */}
      {!isLoading && !error && matches.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-sm text-neutral-300">
          Todavía no hay partidos cargados en la base de datos. Puedes añadirlos
          desde el panel de Supabase en la tabla <strong>matches</strong>.
        </div>
      )}

      {/* Partidos del paso actual (agrupados por fase/grupo) */}
      {!isLoading && !error && matches.length > 0 && stepIndex > 0 && currentGroup && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold text-neutral-50">{currentGroup}</p>
          <p className="mt-1 text-xs text-neutral-400">
            Completa {currentCompleteCount}/{currentMatches.length} partidos para
            habilitar “Siguiente”.
          </p>

          <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wide text-neutral-300">
                <tr>
                  <th className="px-4 py-3 text-left">Partido</th>
                  <th className="px-4 py-3 text-left">Fecha / hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-transparent">
                {currentMatches.map((match) => {
                  const value = predictions[match.id] ?? { home: "", away: "" };
                  const kickoff = new Date(match.kickoff_at);
                  const filled = isMatchFilled(match.id);
                  return (
                    <tr key={match.id}>
                      <td className="px-4 py-3 text-left text-neutral-100">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm sm:text-base">
                            {match.home_logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={match.home_logo_url}
                                alt={match.home_team}
                                className="h-5 w-5 rounded-sm"
                              />
                            ) : null}
                            <span className="font-semibold">
                              {match.home_team}
                            </span>
                            <span className="text-neutral-400">vs</span>
                            {match.away_logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={match.away_logo_url}
                                alt={match.away_team}
                                className="h-5 w-5 rounded-sm"
                              />
                            ) : null}
                            <span className="font-semibold">
                              {match.away_team}
                            </span>
                            {filled ? (
                              <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200">
                                listo
                              </span>
                            ) : null}
                          </div>

                          <div className="flex gap-6">
                            <div>
                              <p className="text-xs text-neutral-400">
                                Goles {match.home_team}
                              </p>
                              <input
                                disabled={!championLocked}
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                onKeyDown={(e) => {
                                  if (["e", "E"].includes(e.key)) {
                                    e.preventDefault();
                                  }
                                }}
                                className="mt-1 w-16 rounded border border-white/20 bg-neutral-900 px-2 py-1 text-center text-sm text-neutral-50 outline-none focus:border-emerald-400 disabled:opacity-60"
                                value={value.home}
                                onChange={(e) => {
                                  const cleaned = e.target.value.replace(
                                    /[^0-9]/g,
                                    ""
                                  );
                                  handlePredictionChange(match.id, "home", cleaned);
                                }}
                              />
                            </div>
                            <div>
                              <p className="text-xs text-neutral-400">
                                Goles {match.away_team}
                              </p>
                              <input
                                disabled={!championLocked}
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                onKeyDown={(e) => {
                                  if (["e", "E"].includes(e.key)) {
                                    e.preventDefault();
                                  }
                                }}
                                className="mt-1 w-16 rounded border border-white/20 bg-neutral-900 px-2 py-1 text-center text-sm text-neutral-50 outline-none focus:border-emerald-400 disabled:opacity-60"
                                value={value.away}
                                onChange={(e) => {
                                  const cleaned = e.target.value.replace(
                                    /[^0-9]/g,
                                    ""
                                  );
                                  handlePredictionChange(match.id, "away", cleaned);
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-left text-xs text-neutral-300">
                        {kickoff.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}



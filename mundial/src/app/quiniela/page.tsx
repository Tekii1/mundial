"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Match = {
  id: string;
  home_team: string;
  away_team: string;
  group_or_phase: string;
  kickoff_at: string;
  home_logo_url?: string | null;
  away_logo_url?: string | null;
  home_score?: number | null;
  away_score?: number | null;
};

type PredictionsState = Record<string, { home: string; away: string }>;

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
  const [hasSavedThisStep, setHasSavedThisStep] = useState(false); // CONTROL DE GUARDADO DUPLICADO
  const [championTeam, setChampionTeam] = useState<string>("");
  const [championLocked, setChampionLocked] = useState<boolean>(false);
  const [isSavingChampion, setIsSavingChampion] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/matches", { 
          cache: "no-store",
          headers: { "Pragma": "no-cache", "Cache-Control": "no-cache" }
        });
        if (!res.ok) throw new Error("No se pudieron cargar los partidos");
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
  }, [router, supabase.auth]);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/champion", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
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

  const handlePredictionChange = (matchId: string, field: "home" | "away", value: string) => {
    // PREVENCIÓN DE NEGATIVOS: No permitir el signo menos ni valores menores a 0
    if (value.includes("-")) return;
    
    setPredictions((prev) => ({
      ...prev,
      [matchId]: {
        home: field === "home" ? value : prev[matchId]?.home ?? "",
        away: field === "away" ? value : prev[matchId]?.away ?? "",
      },
    }));
    // Si el usuario modifica algo, permitimos guardar de nuevo
    setHasSavedThisStep(false);
  };

  const handleSavePredictions = async () => {
    if (hasSavedThisStep) return; // EVITAR GUARDADO DUPLICADO
    
    setSaveMessage(null);
    const trimmedName = userName.trim();
    if (!trimmedName || !accessToken) return;

    const payload = Object.entries(predictions)
      .map(([matchId, scores]) => {
        const home = parseInt(scores.home, 10);
        const away = parseInt(scores.away, 10);
        if (Number.isNaN(home) || Number.isNaN(away)) return null;
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
        body: JSON.stringify({ userName: trimmedName, predictions: payload }),
      });

      if (!res.ok) throw new Error("Error al guardar");
      setHasSavedThisStep(true); // BLOQUEAR BOTÓN TRAS ÉXITO
      setSaveMessage("¡Quiniela guardada correctamente!");
    } catch (err) {
      setSaveMessage("Error al guardar la quiniela.");
    } finally {
      setIsSaving(false);
    }
  };

  const teams = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => { set.add(m.home_team); set.add(m.away_team); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [matches]);

  const groupedMatches = useMemo(() => {
    const map = new Map<string, Match[]>();
    matches.forEach((m) => {
      const key = m.group_or_phase || "Otros";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [matches]);

  const isMatchFilled = (matchId: string) => {
    const p = predictions[matchId];
    return p ? p.home.trim() !== "" && p.away.trim() !== "" : false;
  };

  const steps = useMemo(() => ["__champion__", ...groupedMatches.map(([g]) => g)], [groupedMatches]);
  const currentGroup = stepIndex <= 0 ? null : steps[stepIndex];
  const currentMatches = currentGroup ? groupedMatches.find(([g]) => g === currentGroup)?.[1] ?? [] : [];
  const currentCompleteCount = currentMatches.filter((m) => isMatchFilled(m.id)).length;
  const canGoNext = stepIndex === 0 ? championLocked : currentMatches.length > 0 && currentCompleteCount === currentMatches.length;

  const handleSaveChampion = async () => {
    if (!accessToken || !championTeam) return;
    try {
      setIsSavingChampion(true);
      const res = await fetch("/api/champion", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ userName: userName.trim(), championTeam }),
      });
      if (!res.ok) throw new Error();
      setChampionLocked(true);
      setSaveMessage("Candidato a campeón guardado.");
    } catch (err) {
      setSaveMessage("Error guardando candidato.");
    } finally {
      setIsSavingChampion(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Crear quiniela</h1>
        <p className="text-sm text-neutral-300">Selecciona tus marcadores para el Mundial.</p>
      </header>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-neutral-200">
            Paso {stepIndex + 1} de {steps.length} {currentGroup && `· ${currentGroup}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setStepIndex(i => Math.max(0, i - 1)); setHasSavedThisStep(false); }} disabled={stepIndex === 0} className="rounded-full border border-white/15 px-4 py-2 text-xs disabled:opacity-50">Anterior</button>
          <button onClick={() => { setStepIndex(i => Math.min(steps.length - 1, i + 1)); setHasSavedThisStep(false); }} disabled={!canGoNext || stepIndex >= steps.length - 1} className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-neutral-950 disabled:opacity-60">Siguiente</button>
        </div>
      </div>

      {stepIndex === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <label className="block text-xs font-medium text-neutral-300">Candidato a campeón</label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <select disabled={championLocked} className="flex-1 rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-neutral-50" value={championTeam} onChange={(e) => setChampionTeam(e.target.value)}>
              <option value="">Selecciona un equipo</option>
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={handleSaveChampion} disabled={championLocked || isSavingChampion} className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-neutral-950">
              {championLocked ? "Guardado" : isSavingChampion ? "Guardando..." : "Guardar campeón"}
            </button>
          </div>
        </div>
      )}

      {stepIndex > 0 && currentGroup && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold">{currentGroup}</p>
            <button 
              onClick={handleSavePredictions} 
              disabled={isSaving || hasSavedThisStep} 
              className={`rounded-full px-5 py-2 text-sm font-semibold text-neutral-950 transition-colors ${hasSavedThisStep ? 'bg-neutral-600' : 'bg-emerald-500'}`}
            >
              {isSaving ? "Guardando..." : hasSavedThisStep ? "✓ Guardado" : "Guardar quiniela"}
            </button>
          </div>
          
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10">
              <tbody className="divide-y divide-white/10 bg-transparent">
                {currentMatches.map((match) => {
                  const val = predictions[match.id] ?? { home: "", away: "" };
                  return (
                    <tr key={match.id}>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 text-right font-medium">{match.home_team}</div>
                          <input 
                            type="number" 
                            min="0" // Evita negativos con flechas
                            value={val.home} 
                            onChange={(e) => handlePredictionChange(match.id, "home", e.target.value)} 
                            className="w-12 rounded border border-white/20 bg-neutral-900 text-center py-1" 
                          />
                          <span className="text-neutral-500">-</span>
                          <input 
                            type="number" 
                            min="0" // Evita negativos con flechas
                            value={val.away} 
                            onChange={(e) => handlePredictionChange(match.id, "away", e.target.value)} 
                            className="w-12 rounded border border-white/20 bg-neutral-900 text-center py-1" 
                          />
                          <div className="flex-1 text-left font-medium">{match.away_team}</div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {saveMessage && <p className="text-center text-sm text-emerald-400 font-medium animate-pulse">{saveMessage}</p>}
    </section>
  );
}
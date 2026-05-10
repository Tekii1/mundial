"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

// --- TIPOS ---
type Match = {
  id: string;
  home_team: string;
  away_team: string;
  group_or_phase: string;
  kickoff_at: string;
};

type PredictionsState = Record<string, { home: string; away: string }>;

export default function QuinielaPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();

  // --- ESTADOS ---
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<PredictionsState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [hasSavedThisStep, setHasSavedThisStep] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Estados del Campeón
  const [championTeam, setChampionTeam] = useState<string>("");
  const [championLocked, setChampionLocked] = useState<boolean>(false);
  const [isSavingChampion, setIsSavingChampion] = useState(false);

  const hasLoaded = useRef(false);

  // --- 1. CARGA DE DATOS ÚNICA ---
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    const initData = async () => {
      try {
        setIsLoading(true);

        const resMatches = await fetch("/api/matches");
        const matchesData = await resMatches.json();
        setMatches(matchesData);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/auth");
          return;
        }

        const token = session.access_token;
        setAccessToken(token);
        setUserName(window.localStorage.getItem("quinielaUserName") || "");

        // Cargar Predicciones
        const resPreds = await fetch("/api/predictions", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resPreds.ok) {
          const predData = await resPreds.json();
          const loaded: PredictionsState = {};
          predData.forEach((p: any) => {
            loaded[p.match_id] = {
              home: p.predicted_home_score?.toString() ?? "",
              away: p.predicted_away_score?.toString() ?? "",
            };
          });
          setPredictions(loaded);
        }

        // Cargar Campeón
        const resChamp = await fetch("/api/champion", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resChamp.ok) {
          const champData = await resChamp.json();
          if (champData?.championTeam) {
            setChampionTeam(champData.championTeam);
            setChampionLocked(true);
          }
        }
      } catch (err) {
        console.error("Error en carga:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initData();
  }, [router, supabase.auth]);

  // --- 2. LÓGICA DE UI ---
  const isMatchLocked = (kickoffAt: string) => new Date() >= new Date(kickoffAt);

  const teams = useMemo(() => {
    const set = new Set<string>();
    matches.forEach(m => { set.add(m.home_team); set.add(m.away_team); });
    return Array.from(set).sort();
  }, [matches]);

  const groupedMatches = useMemo(() => {
    const map = new Map<string, Match[]>();
    matches.forEach(m => {
      let key = m.group_or_phase || "Otros";
      if (key.toLowerCase().includes("grupo")) {
        const match = key.match(/Grupo\s+[A-L]/i);
        if (match) key = match[0].toUpperCase();
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [matches]);

  const steps = useMemo(() => ["__champion__", ...groupedMatches.map(([g]) => g)], [groupedMatches]);
  const currentGroup = steps[stepIndex];
  const currentMatches = groupedMatches.find(([g]) => g === currentGroup)?.[1] ?? [];
  const isAllGroupLocked = currentMatches.length > 0 && currentMatches.every(m => isMatchLocked(m.kickoff_at));

  // --- 3. MANEJADORES ---
  const handlePredictionChange = (matchId: string, field: "home" | "away", value: string) => {
    const match = matches.find(m => m.id === matchId);
    if (match && isMatchLocked(match.kickoff_at)) return;

    setPredictions(prev => ({
      ...prev,
      [matchId]: {
        home: field === "home" ? value : (prev[matchId]?.home || ""),
        away: field === "away" ? value : (prev[matchId]?.away || ""),
      }
    }));
    setHasSavedThisStep(false);
  };

  const handleSavePredictions = async () => {
    if (!accessToken || isSaving) return;
    setIsSaving(true);
    try {
      const payload = Object.entries(predictions)
        .map(([id, s]) => ({ matchId: id, home: parseInt(s.home), away: parseInt(s.away) }))
        .filter(p => !isNaN(p.home) && !isNaN(p.away));

      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ userName, predictions: payload }),
      });
      if (res.ok) {
        setHasSavedThisStep(true);
        setSaveMessage("¡Marcadores guardados!");
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveChampion = async () => {
    if (!accessToken || !championTeam) return;
    try {
      setIsSavingChampion(true);
      const res = await fetch("/api/champion", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ userName, championTeam }),
      });
      if (res.ok) {
        setChampionLocked(true);
        setSaveMessage("¡Campeón guardado!");
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } finally {
      setIsSavingChampion(false);
    }
  };

  if (isLoading) return <div className="p-10 text-center text-emerald-500 font-bold">Cargando quiniela...</div>;

  return (
    <section className="max-w-4xl mx-auto p-4 space-y-6 text-white pb-24">
      <header className="flex flex-col sm:flex-row justify-between items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-black text-emerald-500 tracking-tighter">QUINIELA 2026</h1>
          <p className="text-neutral-400 text-sm italic">Paso {stepIndex + 1} de {steps.length}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setStepIndex(i => i - 1); setHasSavedThisStep(false); }} disabled={stepIndex === 0} className="px-4 py-2 rounded-full border border-white/10 disabled:opacity-20 hover:bg-white/5 transition-colors">Anterior</button>
          <button onClick={() => { setStepIndex(i => i + 1); setHasSavedThisStep(false); }} disabled={stepIndex === steps.length - 1} className="px-4 py-2 rounded-full bg-emerald-500 text-black font-bold disabled:opacity-20 hover:bg-emerald-400 transition-colors">Siguiente</button>
        </div>
      </header>

      {/* VISTA CAMPEÓN */}
      {currentGroup === "__champion__" && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-4xl font-black">🏆 EL CAMPEÓN</h2>
            <p className="text-neutral-400 text-sm">Esta elección no se podrá cambiar después de guardar.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <select 
              disabled={championLocked}
              value={championTeam}
              onChange={(e) => setChampionTeam(e.target.value)}
              className="flex-1 bg-neutral-900 border border-white/15 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Selecciona tu favorito...</option>
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button 
              onClick={handleSaveChampion}
              disabled={championLocked || isSavingChampion || !championTeam}
              className="bg-emerald-500 text-black px-8 py-3 rounded-xl font-bold hover:bg-emerald-400 disabled:opacity-50 transition-all"
            >
              {championLocked ? "CONFIRMADO ✓" : isSavingChampion ? "GUARDANDO..." : "GUARDAR CAMPEÓN"}
            </button>
          </div>
        </div>
      )}

      {/* VISTA GRUPOS */}
      {currentGroup !== "__champion__" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-black uppercase italic">{currentGroup}</h2>
            {!isAllGroupLocked && (
              <button 
                onClick={handleSavePredictions}
                disabled={isSaving || hasSavedThisStep}
                className={`px-6 py-2 rounded-full font-bold transition-all ${hasSavedThisStep ? 'bg-neutral-800 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-500 text-black'}`}
              >
                {isSaving ? "GUARDANDO..." : hasSavedThisStep ? "✓ GUARDADO" : "GUARDAR GRUPO"}
              </button>
            )}
          </div>

          <div className="grid gap-3">
            {currentMatches.map((match) => {
              const locked = isMatchLocked(match.kickoff_at);
              const val = predictions[match.id] || { home: "", away: "" };
              return (
                <div key={match.id} className={`grid grid-cols-[1fr_auto_1fr] items-center p-4 rounded-2xl border ${locked ? 'bg-black/40 border-white/5 opacity-60' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
                  <span className="text-right font-bold pr-3 truncate">{match.home_team}</span>
                  <div className="flex items-center gap-2 bg-neutral-900 rounded-lg p-1 border border-white/10">
                    <input 
                      type="number" disabled={locked} 
                      value={val.home || ""} 
                      onChange={(e) => handlePredictionChange(match.id, "home", e.target.value)} 
                      className={`w-10 h-10 text-center font-bold bg-transparent outline-none ${locked ? 'text-neutral-500' : 'text-emerald-500'}`} 
                    />
                    <span className="text-neutral-700 font-bold text-xs">VS</span>
                    <input 
                      type="number" disabled={locked} 
                      value={val.away || ""} 
                      onChange={(e) => handlePredictionChange(match.id, "away", e.target.value)} 
                      className={`w-10 h-10 text-center font-bold bg-transparent outline-none ${locked ? 'text-neutral-500' : 'text-emerald-500'}`} 
                    />
                  </div>
                  <span className="text-left font-bold pl-3 truncate">{match.away_team}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MENSAJE FLOTANTE */}
      {saveMessage && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-neutral-900 border border-emerald-500/50 px-8 py-3 rounded-full shadow-2xl z-50 animate-in slide-in-from-bottom-2">
          <p className="text-emerald-400 font-bold text-sm tracking-wide">{saveMessage}</p>
        </div>
      )}
    </section>
  );
}
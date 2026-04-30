// Cliente mínimo para API-Football (API-SPORTS)
// Documentación: https://www.api-football.com/documentation-v3

type ApiFootballResponse<T> = {
  response: T[];
  errors?: unknown;
};

export type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string; // ISO string
    status: {
      short: string; // FT, NS, etc.
    };
  };
  league: {
    id: number;
    name: string;
    season: number;
    round: string;
  };
  teams: {
    home: { name: string; logo?: string };
    away: { name: string; logo?: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

// Hace una petición GET a API-Football y devuelve el JSON parseado
export async function apiFootballGet<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>
): Promise<ApiFootballResponse<T>> {
  const apiKey = requireEnv("APIFOOTBALL_API_KEY");
  const baseUrl =
    process.env.APIFOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io";

  const url = new URL(`${baseUrl}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined) return;
    url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString(), {
    headers: {
      "x-apisports-key": apiKey,
    },
    // Para endpoints server-side, mejor no cachear
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API-Football error ${res.status}: ${text}`);
  }

  return (await res.json()) as ApiFootballResponse<T>;
}

// Consideramos como "finalizado" cuando ya hay marcador definitivo
export function isFinishedStatus(short: string): boolean {
  return ["FT", "AET", "PEN"].includes(short);
}


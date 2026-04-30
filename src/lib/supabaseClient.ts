import { createClient } from "@supabase/supabase-js";

// Tipado mínimo del cliente; si quisieras, aquí se podría usar un tipo generado
// con la definición completa de tu base de datos.
type SupabaseClient = ReturnType<typeof createClient>;

// Función para crear un cliente de Supabase usando las variables de entorno.
// Para desarrollo local, además dejamos un fallback con los valores actuales
// de tu proyecto para evitar problemas de carga de .env en el entorno.
export function getSupabaseClient(): SupabaseClient {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://rztnlfqmhcpfkfqthlxv.supabase.co";

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "sb_publishable_GkWiHX2Ws79JzbW1eT4Bog_prsK9aul";

  return createClient(url, anonKey);
}





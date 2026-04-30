"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

// Componente que muestra el botón de auth con las primeras letras del alias si existe.
// - Si no hay alias: botón simple que lleva a /auth (pantalla de inicio de sesión)
// - Si hay alias: botón con iniciales y menú desplegable con opciones (ir a quiniela, cerrar sesión)
export function UserAuthLink() {
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [alias, setAlias] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("quinielaUserName");
    if (stored && stored.trim()) {
      setAlias(stored.trim());
    }
  }, []);

  const hasAlias = !!alias && alias.trim().length > 0;

  // Si no hay alias, mostramos el botón clásico de "Iniciar sesión"
  if (!hasAlias) {
    return (
      <Link
        href="/auth"
        className="hidden rounded-full border border-white/15 px-4 py-1.5 text-neutral-200 hover:border-white/40 hover:bg-white/5 sm:inline-flex"
      >
        Iniciar sesión
      </Link>
    );
  }

  const label =
    alias!.length >= 3 ? alias!.slice(0, 3).toUpperCase() : alias!.toUpperCase();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignoramos errores de signOut en cliente
    }

    if (typeof window !== "undefined") {
      window.localStorage.removeItem("quinielaUserName");
    }

    setAlias(null);
    setOpen(false);
    router.push("/");
  };

  return (
    <div className="relative hidden sm:inline-flex">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-200 hover:border-white/40 hover:bg-white/5"
      >
        {label}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-20 w-40 rounded-xl border border-white/10 bg-neutral-900/95 p-2 text-xs shadow-lg shadow-black/40">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/quiniela");
            }}
            className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-neutral-100 hover:bg-white/10"
          >
            <span>Ver mi quiniela</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-1 flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-red-300 hover:bg-red-500/10"
          >
            <span>Cerrar sesión</span>
          </button>
        </div>
      )}
    </div>
  );
}



"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

// Página sencilla para que el usuario establezca una nueva contraseña
// después de seguir el enlace de recuperación enviado por correo.
export default function AuthCallbackPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleUpdatePassword = async () => {
    setMessage(null);

    if (!password || !confirmPassword) {
      setMessage("Por favor ingresa y confirma tu nueva contraseña.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    try {
      setIsSubmitting(true);

      // Supabase identifica al usuario a través del token del enlace de recuperación
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      setMessage("Contraseña actualizada correctamente. Redirigiendo al inicio...");

      setTimeout(() => {
        router.push("/auth");
      }, 2000);
    } catch (err) {
      setMessage(
        err instanceof Error
          ? `No se pudo actualizar la contraseña: ${err.message}`
          : "Error desconocido al actualizar la contraseña."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex max-w-md flex-col gap-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Restablecer contraseña
        </h1>
        <p className="text-sm text-neutral-300">
          Ingresa tu nueva contraseña para tu cuenta de quiniela.
        </p>
      </header>

      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-300">
            Nueva contraseña
          </label>
          <input
            type="password"
            placeholder="Mínimo 6 caracteres"
            className="w-full rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-emerald-400"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-300">
            Confirmar nueva contraseña
          </label>
          <input
            type="password"
            placeholder="Repite la nueva contraseña"
            className="w-full rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-emerald-400"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleUpdatePassword}
          className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Actualizando..." : "Actualizar contraseña"}
        </button>

        {message && (
          <p className="text-xs text-neutral-300">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}


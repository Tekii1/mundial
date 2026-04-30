"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

// Página sencilla de autenticación con email y contraseña usando Supabase Auth
export default function AuthPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Envía un correo para restablecer la contraseña del usuario
  const handleResetPassword = async () => {
    setMessage(null);

    if (!email) {
      setMessage("Ingresa tu correo para enviar el enlace de recuperación.");
      return;
    }

    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback`,
      });

      if (error) {
        throw error;
      }

      setMessage(
        "Te enviamos un correo con instrucciones para restablecer tu contraseña."
      );
    } catch (err) {
      setMessage(
        err instanceof Error
          ? `No se pudo enviar el correo de recuperación: ${err.message}`
          : "Error desconocido al intentar enviar el correo de recuperación."
      );
    }
  };

  const handleSubmit = async () => {
    setMessage(null);

    if (!email || !password) {
      setMessage("Por favor ingresa correo y contraseña.");
      return;
    }

    // El alias solo es obligatorio al crear cuenta
    if (mode === "register" && !username.trim()) {
      setMessage("Por favor elige un alias o nombre para mostrar.");
      return;
    }

    try {
      setIsSubmitting(true);

      if (mode === "register") {
        // Registro de nuevo usuario con email/contraseña
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        // Guardamos el alias elegido como nombre para mostrar en la quiniela
        if (typeof window !== "undefined" && username.trim()) {
          window.localStorage.setItem(
            "quinielaUserName",
            username.trim()
          );
        }

        setMessage(
          "Registro exitoso. Revisa tu correo si se requiere confirmación y luego inicia sesión."
        );
      } else {
        // Inicio de sesión con email/contraseña
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        // Si aún no hay alias guardado en este navegador, usamos una derivación del correo
        if (typeof window !== "undefined") {
          const existing = window.localStorage.getItem("quinielaUserName");
          if (!existing || !existing.trim()) {
            const fallbackAlias =
              email.split("@")[0]?.trim() || email.trim();
            window.localStorage.setItem("quinielaUserName", fallbackAlias);
          }
          // Hacemos un refresh completo para que el layout recoja el alias sin problemas
          window.location.href = "/";
          return;
        }

        // En entornos donde window no esté disponible, usamos navegación clásica
        setMessage("Has iniciado sesión correctamente. Ya puedes ir a tu quiniela.");
        router.push("/");
      }
    } catch (err) {
      setMessage(
        err instanceof Error
          ? `Error de autenticación: ${err.message}`
          : "Error desconocido durante la autenticación."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex max-w-md flex-col gap-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
        </h1>
        <p className="text-sm text-neutral-300">
          Usa tu correo para identificar tus quinielas. Más adelante podremos
          mostrar tu ranking y tus predicciones asociadas a este usuario.
        </p>
      </header>

      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm">
        {mode === "register" && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-300">
              Alias / nombre para mostrar
            </label>
            <input
              type="text"
              placeholder="Ej. Diego, La Tía Goles..."
              className="w-full rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-emerald-400"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <p className="text-[11px] text-neutral-400">
              Este alias se usará como tu nombre en la quiniela.
            </p>
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-300">
            Correo electrónico
          </label>
          <input
            type="email"
            placeholder="tucorreo@ejemplo.com"
            className="w-full rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-emerald-400"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-300">
            Contraseña
          </label>
          <input
            type="password"
            placeholder="Mínimo 6 caracteres"
            className="w-full rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-emerald-400"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleSubmit}
          className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? mode === "login"
              ? "Iniciando sesión..."
              : "Creando cuenta..."
            : mode === "login"
            ? "Iniciar sesión"
            : "Crear cuenta"}
        </button>

        {mode === "login" && (
          <button
            type="button"
            onClick={handleResetPassword}
            className="mt-2 text-xs text-neutral-400 hover:text-neutral-200"
          >
            ¿Olvidaste tu contraseña?
          </button>
        )}

        {message && (
          <p className="text-xs text-neutral-300">
            {message}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setMessage(null);
          setMode(mode === "login" ? "register" : "login");
        }}
        className="self-start text-xs text-neutral-400 hover:text-neutral-200"
      >
        {mode === "login"
          ? "¿No tienes cuenta? Crear una nueva"
          : "¿Ya tienes cuenta? Inicia sesión"}
      </button>
    </section>
  );
}


import Link from "next/link";

// Página de inicio: landing con explicación general y accesos a quiniela y ranking
export default function Home() {
  return (
    <section className="flex flex-1 flex-col justify-center gap-10">
      {/* Bloque principal con título y descripción de la app */}
      <div className="max-w-2xl space-y-4">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-emerald-400">
          Mundial · Quiniela familiar
        </p>
        <h1 className="text-balance text-4xl font-semibold leading-tight sm:text-5xl">
          Bienvenidos a la Quiniela Familiar de la familia.
        </h1>
        <p className="text-pretty text-base text-neutral-300 sm:text-lg">
          Crea las predicciones de cada partido y mira el ranking en tiempo real
          a medida que avanza el torneo.
        </p>
      </div>

      {/* Accesos rápidos a las secciones principales */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/quiniela"
          className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-neutral-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400"
        >
          Empezar una quiniela
        </Link>
        <Link
          href="/ranking"
          className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-2.5 text-sm font-medium text-neutral-100 hover:border-white/35 hover:bg-white/5"
        >
          Ver ranking actual
        </Link>
      </div>

      {/* Tarjetas con resumen de funcionalidades principales */}
      <div className="mt-6 grid gap-4 text-sm text-neutral-300 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="font-semibold text-neutral-50">Predicciones simples</p>
          <p className="mt-1 text-xs text-neutral-300">
            Define marcadores para cada partido y guarda todo en una sola vista.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="font-semibold text-neutral-50">Ranking automático</p>
          <p className="mt-1 text-xs text-neutral-300">
            Calcula los puntos por aciertos y muestra la tabla de posiciones.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="font-semibold text-neutral-50">Pensado para familia</p>
          <p className="mt-1 text-xs text-neutral-300">
            Interfaz sencilla, sin registro complicado ni cosas raras.
          </p>
        </div>
      </div>
    </section>
  );
}

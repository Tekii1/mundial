import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { UserAuthLink } from "@/components/UserAuthLink";
import "./globals.css";

// Configuración de fuentes globales de la app
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Metadatos de la aplicación (título, descripción, etc.)
export const metadata: Metadata = {
  title: "Quiniela Familiar Mundial",
  description: "Crea y consulta las predicciones del Mundial en familia.",
};

// Layout raíz: envuelve todas las páginas con la navegación y el footer
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-neutral-950 text-neutral-100 antialiased`}
      >
        <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950">
          {/* Cabecera con navegación principal entre inicio, quiniela y ranking */}
          <header className="border-b border-white/10 bg-neutral-950/70 backdrop-blur">
            <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                Quiniela Mundial
              </Link>
              <div className="flex gap-3 text-sm">
                <Link
                  href="/ranking"
                  className="rounded-full bg-emerald-500 px-4 py-1.5 font-medium text-neutral-950 hover:bg-emerald-400"
                >
                  Ver ranking
                </Link>
                <UserAuthLink />
              </div>
            </nav>
          </header>

          {/* Contenido variable de cada página */}
          <main className="mx-auto flex max-w-5xl flex-1 flex-col px-6 py-10">
            {children}
          </main>

          {/* Pie de página con texto descriptivo */}
          <footer className="border-t border-white/10 bg-neutral-950/70 py-4 text-center text-xs text-neutral-400">
            Hecho en familia para el Mundial.
          </footer>
        </div>
      </body>
    </html>
  );
}

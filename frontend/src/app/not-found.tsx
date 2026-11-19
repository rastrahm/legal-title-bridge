import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 px-6 text-center text-slate-50">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
        404
      </p>
      <h1 className="text-3xl font-bold">Ruta no encontrada</h1>
      <p className="max-w-xl text-slate-300">
        La vista solicitada no existe en Legal Title Bridge.
      </p>
      <Link
        className="rounded-full border border-slate-700 px-5 py-3 font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200"
        href="/"
      >
        Volver al inicio
      </Link>
    </main>
  );
}

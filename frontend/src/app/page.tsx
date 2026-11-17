/**
 * Renders the BOOT home page for Legal Title Bridge.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-slate-950 px-6 py-20 text-slate-50">
      <section className="mx-auto flex max-w-3xl flex-col gap-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-black/30 sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Legal Title Bridge
        </p>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            BOOT frontend para titulacion legal tokenizada
          </h1>
          <p className="text-lg leading-8 text-slate-300">
            Este modulo inicia la experiencia web para coordinar identidad,
            documentos, estados legales y operaciones on-chain del puente de
            titulos.
          </p>
        </div>
        <dl className="grid gap-4 text-sm text-slate-300 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <dt className="font-semibold text-slate-50">Stack</dt>
            <dd>Next.js App Router, React 19 y TypeScript estricto.</dd>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <dt className="font-semibold text-slate-50">Seguridad</dt>
            <dd>CSP, X-Frame-Options DENY y sin HTML peligroso.</dd>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <dt className="font-semibold text-slate-50">Estado</dt>
            <dd>Base BOOT lista para pruebas y evolucion funcional.</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

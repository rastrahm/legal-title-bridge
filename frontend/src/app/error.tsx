"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 px-6 text-center text-slate-50">
      <h1 className="text-3xl font-bold">No pudimos cargar el modulo</h1>
      <p className="max-w-xl text-slate-300">
        Ocurrio un error inesperado en Legal Title Bridge. Puedes reintentar la
        carga o revisar el estado de la aplicacion.
      </p>
      <p className="text-sm text-slate-500">{error.message}</p>
      <button
        className="rounded-full bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
        type="button"
        onClick={reset}
      >
        Reintentar
      </button>
    </main>
  );
}

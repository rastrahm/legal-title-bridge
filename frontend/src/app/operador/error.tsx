"use client";

export default function OperadorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">Error en operador</h1>
      <p className="text-sm text-slate-400">{error.message}</p>
      <button
        type="button"
        className="rounded-full bg-cyan-300 px-4 py-2 font-semibold text-slate-950"
        onClick={reset}
      >
        Reintentar
      </button>
    </main>
  );
}

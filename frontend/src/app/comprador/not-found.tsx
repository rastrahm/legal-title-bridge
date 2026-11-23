import Link from "next/link";

export default function CompradorNotFound() {
  return (
    <main className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">Comprador no encontrado</h1>
      <Link className="text-cyan-300 underline" href="/comprador">
        Volver al ingreso
      </Link>
    </main>
  );
}

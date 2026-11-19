import Link from "next/link";

export default function CarteraNotFound() {
  return (
    <main className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">Cartera no encontrada</h1>
      <Link href="/" className="text-cyan-300 underline">
        Inicio
      </Link>
    </main>
  );
}

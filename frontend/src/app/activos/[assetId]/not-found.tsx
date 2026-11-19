import Link from "next/link";

export default function AssetNotFound() {
  return (
    <main className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">Activo no encontrado</h1>
      <Link href="/activos" className="text-cyan-300 underline">
        Volver al explorador
      </Link>
    </main>
  );
}

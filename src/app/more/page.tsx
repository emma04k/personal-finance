import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function MorePage() {
  return (
    <AppShell activeHref="/more">
      <section className="placeholder-page" aria-labelledby="more-heading">
        <p className="eyebrow">Preferencias</p>
        <h1 id="more-heading">Más opciones</h1>
        <p>Reportes, categorías, privacidad y ajustes viven en esta área.</p>
        <div className="placeholder-notice" role="status">
          <Link href="/reports">Reportes mensuales</Link>
          <span>Exporta tu periodo seleccionado como CSV seguro.</span>
        </div>
      </section>
    </AppShell>
  );
}

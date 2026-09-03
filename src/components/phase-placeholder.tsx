import { AppShell } from "@/components/app-shell";

export function PhasePlaceholder({
  activeHref,
  description,
  eyebrow,
  title,
}: {
  activeHref: string;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <AppShell activeHref={activeHref}>
      <section className="placeholder-page" aria-labelledby="placeholder-title">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="placeholder-title">{title}</h1>
        <p>{description}</p>
        <div className="placeholder-notice" role="status">
          Este módulo se construirá en una fase posterior.
        </div>
      </section>
    </AppShell>
  );
}
